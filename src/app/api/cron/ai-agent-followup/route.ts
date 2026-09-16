import { createServiceClient } from "@/lib/supabase/service";
import { getLatestThreadState, hasHumanReplied, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const MIN_GAP_BETWEEN_FOLLOWUPS_MS = 4 * 24 * 60 * 60 * 1000;
// Best-effort local-morning send window. A prospect without a stored
// timezone (the common case for a cold lead) skips this gate entirely
// rather than never getting followed up — "if available" per the ask.
const LOCAL_HOUR_WINDOW = [9, 12] as const;

function isWithinLocalMorning(timezone: string | null): boolean {
  if (!timezone) return true;
  try {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date()));
    return hour >= LOCAL_HOUR_WINDOW[0] && hour < LOCAL_HOUR_WINDOW[1];
  } catch {
    return true;
  }
}

function toHtml(text: string): string {
  return text
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

type Config = { tone: string | null; guidelines: string | null; knowledge_base: string | null; booking_link: string | null };

function buildSystemPrompt(config: Config, fromContext: string): string {
  return `${fromContext} Tone: ${config.tone ?? "professional, direct, human, 2-6 sentences"}.

GUIDELINES (follow exactly, especially the Follow-up section):
${config.guidelines ?? "none set yet"}

KNOWLEDGE BASE:
${config.knowledge_base ?? "none set yet"}

BOOKING LINK: ${config.booking_link ?? "none configured yet"}
${config.booking_link ? `If it makes sense to nudge toward a call, use this exact link: ${config.booking_link}` : "No real booking link exists yet. NEVER invent one."}

Never use bracket placeholders of any kind. Never manufacture fake urgency. No em dashes. No AI-sounding language.

FINAL OVERRIDE: do not proactively bring up acquisition, lead generation, or "full-stack" unless they previously asked about it. When in doubt, say less.`;
}

// Opt-in only: this only ever touches a prospect who was explicitly dragged
// into a campaign at /follow-ups — never a blind sweep of every CRM lead at
// a given stage. A campaign's channel decides the trust level:
//   - 'instantly': fully autonomous, replies land in the original thread
//     (same gates as the reactive reply pipeline: human ownership,
//     staleness, once-per-4-days).
//   - 'sarah': never auto-sent — drafted into followup_drafts for review
//     at /follow-ups, same as before.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: config } = await supabase.from("ai_agent_config").select("*").limit(1).single();
  if (!config?.auto_reply_enabled) {
    return Response.json({ skipped: "auto_reply_enabled is off" });
  }

  const { data: members } = await supabase
    .from("campaign_prospects")
    .select("id, campaign_id, campaigns(channel, name), prospects(id, contact_email, contact_name, company_name, stage, source, timezone, qualification_notes, last_ai_followup_at)")
    .eq("status", "active");

  const results: { lead: string; outcome: string }[] = [];
  let sent = 0;
  let drafted = 0;

  for (const member of members ?? []) {
    const prospect = member.prospects;
    const campaign = member.campaigns;
    if (!prospect || !campaign || !prospect.contact_email) continue;

    if (prospect.last_ai_followup_at && Date.now() - new Date(prospect.last_ai_followup_at).getTime() < 20 * 60 * 60 * 1000) {
      results.push({ lead: prospect.contact_email, outcome: "skipped: already_followed_up_today" });
      continue;
    }
    if (!isWithinLocalMorning(prospect.timezone)) {
      results.push({ lead: prospect.contact_email, outcome: "skipped: outside_local_morning_window" });
      continue;
    }

    if (campaign.channel === "instantly") {
      const outcome = await handleInstantlyFollowUp(supabase, prospect, config);
      results.push({ lead: prospect.contact_email, outcome });
      if (outcome === "sent") {
        sent++;
        await markFollowedUp(supabase, prospect.id);
      }
      continue;
    }

    // 'sarah' channel: always draft-only.
    const draft = await askAI(
      `Write a short, natural follow-up email to a prospect in an active outreach campaign.
Company: ${prospect.company_name}
Contact: ${prospect.contact_name ?? "unknown, use a generic greeting, no placeholders"}
Notes on file: ${prospect.qualification_notes ?? "none"}
Source: ${prospect.source ?? "unknown"}

It should read like a real person continuing an existing relationship, not a cold intro. Output just the email body, no subject line, no signature beyond a first-name sign-off.`,
      { system: buildSystemPrompt(config, "You are writing on behalf of Rehab Revenue."), maxTokens: 300 },
    );
    if (!draft) {
      results.push({ lead: prospect.contact_email, outcome: "no_draft" });
      continue;
    }

    await supabase.from("followup_drafts").insert({
      prospect_id: prospect.id,
      channel: prospect.stage === "no_show" ? "no_show" : "external",
      subject: `Re: ${prospect.company_name}`,
      body: draft,
      is_demo: false,
    });
    await markFollowedUp(supabase, prospect.id);
    drafted++;
    results.push({ lead: prospect.contact_email, outcome: "drafted_for_review" });
  }

  return Response.json({ checked: (members ?? []).length, sent, drafted, results });
}

async function markFollowedUp(supabase: ReturnType<typeof createServiceClient>, prospectId: string) {
  await supabase.from("prospects").update({ last_ai_followup_at: new Date().toISOString() }).eq("id", prospectId);
}

async function handleInstantlyFollowUp(
  supabase: ReturnType<typeof createServiceClient>,
  prospect: { id: string; contact_email: string | null; contact_name: string | null },
  config: Config,
): Promise<string> {
  const state = await getLatestThreadState(prospect.contact_email!);
  if (!state || !state.threadId) return "skipped: no_instantly_thread_found";
  if (state.lastMessageFromLead) return "skipped: lead_spoke_last";

  const lastMessageAge = Date.now() - new Date(state.lastMessageAt).getTime();
  if (lastMessageAge < STALE_AFTER_MS) return "skipped: not_stale_yet";
  if (await hasHumanReplied(state.threadId)) return "skipped: human_owns_thread";

  const { data: recentFollowUp } = await supabase
    .from("audit_log")
    .select("id, created_at")
    .eq("action", "ai_agent_follow_up")
    .contains("after", { thread_id: state.threadId, status: "sent" })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentFollowUp && Date.now() - new Date(recentFollowUp.created_at).getTime() < MIN_GAP_BETWEEN_FOLLOWUPS_MS) {
    return "skipped: followed_up_recently";
  }

  const draft = await askAI(
    `This prospect showed real interest earlier but has gone quiet since our last message. Write a short, natural follow-up that continues the conversation, it should NOT read like a new cold outreach or a generic "just following up."
Their name: ${prospect.contact_name || 'unknown, do not guess it or use a placeholder, skip the name or use "Hi there"'}
Subject of the thread: ${state.subject}
Days since our last message: ${Math.round(lastMessageAge / 86400000)}

Follow every rule in the guidelines below exactly. Output just the email body, no subject line, no signature block beyond a first-name sign-off.`,
    { system: buildSystemPrompt(config, `You are writing FROM the mailbox ${state.eaccount}.`), maxTokens: 300 },
  );
  if (!draft) {
    await logThreadOutcome(supabase, prospect.contact_email!, state, "no_draft");
    return "no_draft";
  }

  const ok = await replyToEmail({
    eaccount: state.eaccount,
    replyToUuid: state.lastMessageId,
    subject: state.subject.startsWith("Re:") ? state.subject : `Re: ${state.subject}`,
    html: toHtml(draft),
  });

  await logThreadOutcome(supabase, prospect.contact_email!, state, ok ? "sent" : "failed", draft);
  return ok ? "sent" : "failed";
}

async function logThreadOutcome(
  supabase: ReturnType<typeof createServiceClient>,
  lead: string,
  state: { threadId: string; eaccount: string },
  status: string,
  draft?: string | null,
) {
  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "ai_agent_follow_up",
    target_type: "instantly_thread",
    after: { eaccount: state.eaccount, lead, thread_id: state.threadId, status, draft },
  });
}
