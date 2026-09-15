import { createServiceClient } from "@/lib/supabase/service";
import { getLatestThreadState, hasHumanReplied, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";

const ALI_EMAIL = "ali@rehab-revenue.com";
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
    // Unrecognized timezone string — don't let bad data block a real lead.
    return true;
  }
}

function toHtml(text: string): string {
  return text
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function buildSystemPrompt(config: { tone: string | null; guidelines: string | null; knowledge_base: string | null; booking_link: string | null }, fromContext: string): string {
  return `${fromContext} Tone: ${config.tone ?? "professional, direct, human, 2-6 sentences"}.

GUIDELINES (follow exactly, especially the Follow-up section):
${config.guidelines ?? "none set yet"}

KNOWLEDGE BASE:
${config.knowledge_base ?? "none set yet"}

BOOKING LINK: ${config.booking_link ?? "none configured yet"}
${config.booking_link ? `If it makes sense to nudge toward a call, use this exact link: ${config.booking_link}` : "No real booking link exists yet. NEVER invent one."}

Never use bracket placeholders of any kind. Never manufacture fake urgency or pretend anyone personally reviewed something they didn't. No em dashes. No AI-sounding language.

FINAL OVERRIDE: do not proactively bring up acquisition, lead generation, or "full-stack" unless they previously asked about it. When in doubt, say less.`;
}

// Daily CRM-driven follow-up sweep — the source of truth is the CRM itself
// (prospects at stage 'interested' or 'no_show'), not just Instantly
// activity. Routing:
//   - Instantly-sourced leads: fully autonomous, replies land back in the
//     original thread (same gates as the reactive pipeline).
//   - Everything else (calendly, website, manual) and ALL no-shows
//     regardless of source: drafted only, held in followup_drafts for a
//     human to review and send via Sarah (Resend) — never auto-sent.
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

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, contact_email, contact_name, company_name, stage, source, timezone, qualification_notes, last_ai_followup_at")
    .in("stage", ["interested", "no_show"])
    .eq("is_demo", false)
    .not("contact_email", "is", null);

  const results: { lead: string; outcome: string }[] = [];
  let sent = 0;
  let drafted = 0;

  for (const prospect of prospects ?? []) {
    if (prospect.last_ai_followup_at && Date.now() - new Date(prospect.last_ai_followup_at).getTime() < 20 * 60 * 60 * 1000) {
      results.push({ lead: prospect.contact_email!, outcome: "skipped: already_followed_up_today" });
      continue;
    }
    if (!isWithinLocalMorning(prospect.timezone)) {
      results.push({ lead: prospect.contact_email!, outcome: "skipped: outside_local_morning_window" });
      continue;
    }

    const isNoShow = prospect.stage === "no_show";
    const isInstantly = prospect.source === "instantly" && !isNoShow;

    if (isInstantly) {
      const outcome = await handleInstantlyFollowUp(supabase, prospect, config);
      results.push({ lead: prospect.contact_email!, outcome });
      if (outcome === "sent") {
        sent++;
        await markFollowedUp(supabase, prospect.id);
      }
      continue;
    }

    // External-channel or no-show: never auto-send, always a human review
    // step. Drafted with whatever real context we have (qualification_notes
    // is the closest thing to a conversation history for a non-Instantly
    // lead — Calendly/website leads don't have an email thread to pull from).
    const draft = await askAI(
      `Write a short, natural follow-up email to a prospect who ${isNoShow ? "no-showed a booked call" : "showed interest but hasn't booked a call yet"}.
Company: ${prospect.company_name}
Contact: ${prospect.contact_name ?? "unknown, use a generic greeting, no placeholders"}
Notes on file: ${prospect.qualification_notes ?? "none"}
Source: ${prospect.source ?? "unknown"}

It should read like a real person continuing an existing relationship, not a cold intro. Output just the email body, no subject line, no signature beyond a first-name sign-off.`,
      { system: buildSystemPrompt(config, "You are writing on behalf of Rehab Revenue."), maxTokens: 300 },
    );

    if (!draft) {
      results.push({ lead: prospect.contact_email!, outcome: "no_draft" });
      continue;
    }

    await supabase.from("followup_drafts").insert({
      prospect_id: prospect.id,
      channel: isNoShow ? "no_show" : "external",
      subject: isNoShow ? `Following up, ${prospect.company_name}` : `Re: ${prospect.company_name}`,
      body: draft,
      is_demo: false,
    });
    await markFollowedUp(supabase, prospect.id);
    drafted++;
    results.push({ lead: prospect.contact_email!, outcome: "drafted_for_review" });
  }

  return Response.json({ checked: (prospects ?? []).length, sent, drafted, results });
}

async function markFollowedUp(supabase: ReturnType<typeof createServiceClient>, prospectId: string) {
  await supabase.from("prospects").update({ last_ai_followup_at: new Date().toISOString() }).eq("id", prospectId);
}

async function handleInstantlyFollowUp(
  supabase: ReturnType<typeof createServiceClient>,
  prospect: { id: string; contact_email: string | null; contact_name: string | null },
  config: { tone: string | null; guidelines: string | null; knowledge_base: string | null; booking_link: string | null },
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

  const { data: everSent } = await supabase
    .from("audit_log")
    .select("id")
    .or("action.eq.ai_agent_auto_reply,action.eq.ai_agent_follow_up")
    .contains("after", { thread_id: state.threadId, status: "sent" })
    .limit(1)
    .maybeSingle();
  const isFirstResponse = !everSent;

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
    cc: isFirstResponse ? [ALI_EMAIL] : undefined,
  });

  await logThreadOutcome(supabase, prospect.contact_email!, state, ok ? "sent" : "failed", draft, isFirstResponse);
  return ok ? "sent" : "failed";
}

async function logThreadOutcome(
  supabase: ReturnType<typeof createServiceClient>,
  lead: string,
  state: { threadId: string; eaccount: string },
  status: string,
  draft?: string | null,
  ccdAli?: boolean,
) {
  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "ai_agent_follow_up",
    target_type: "instantly_thread",
    after: { eaccount: state.eaccount, lead, thread_id: state.threadId, status, draft, ccd_ali: ccdAli },
  });
}
