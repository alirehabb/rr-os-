import { createServiceClient } from "@/lib/supabase/service";
import { getLatestThreadState, hasHumanReplied, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const MIN_GAP_BETWEEN_FOLLOWUPS_MS = 4 * 24 * 60 * 60 * 1000;
export const DEDUPE_WINDOW_MS = 20 * 60 * 60 * 1000;
// Best-effort local-morning send window. A prospect without a stored
// timezone (the common case for a cold lead) skips this gate entirely
// rather than never getting followed up — "if available" per the ask.
export const LOCAL_HOUR_WINDOW = [9, 12] as const;

type SupabaseAny = ReturnType<typeof createServiceClient>;

export function isWithinLocalMorning(timezone: string | null): boolean {
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

export type FollowUpConfig = { tone: string | null; guidelines: string | null; knowledge_base: string | null; booking_link: string | null };

function buildSystemPrompt(config: FollowUpConfig, fromContext: string): string {
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

export type FollowUpMember = {
  id: string;
  campaign_id: string;
  campaigns: { channel: string; name: string } | null;
  prospects: {
    id: string;
    contact_email: string | null;
    contact_name: string | null;
    company_name: string;
    stage: string;
    source: string | null;
    timezone: string | null;
    qualification_notes: string | null;
    last_ai_followup_at: string | null;
  } | null;
};

export type FollowUpOutcome = { prospectId: string; lead: string; outcome: string };

// Every outcome (sent, drafted, or any skip reason) is logged here, keyed
// by prospect_id so a campaign detail view can reconstruct "what actually
// happened" regardless of channel — the instantly-channel skip reasons
// (stale, human-owned, etc) used to only exist in the ephemeral HTTP
// response, which made "see what's happening" impossible after the fact.
async function logOutcome(supabase: SupabaseAny, prospectId: string, campaignId: string, channel: string, status: string, extra?: Record<string, unknown>) {
  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "ai_agent_follow_up",
    target_type: "prospect",
    target_id: prospectId,
    after: { campaign_id: campaignId, channel, status, ...extra },
  });
}

async function markFollowedUp(supabase: SupabaseAny, prospectId: string) {
  await supabase.from("prospects").update({ last_ai_followup_at: new Date().toISOString() }).eq("id", prospectId);
}

// Shared by the hourly cron (all active members) and the manual "Run now"
// button on a campaign's detail page (just that campaign's members) — same
// gates, same logging, so there's exactly one code path to trust.
export async function runFollowUpForMembers(supabase: SupabaseAny, config: FollowUpConfig, members: FollowUpMember[]): Promise<{ sent: number; drafted: number; results: FollowUpOutcome[] }> {
  const results: FollowUpOutcome[] = [];
  let sent = 0;
  let drafted = 0;

  for (const member of members) {
    const prospect = member.prospects;
    const campaign = member.campaigns;
    if (!prospect || !campaign || !prospect.contact_email) continue;

    if (prospect.last_ai_followup_at && Date.now() - new Date(prospect.last_ai_followup_at).getTime() < DEDUPE_WINDOW_MS) {
      results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: "skipped: already_followed_up_today" });
      await logOutcome(supabase, prospect.id, member.campaign_id, campaign.channel, "skipped", { reason: "already_followed_up_today" });
      continue;
    }
    if (!isWithinLocalMorning(prospect.timezone)) {
      results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: "skipped: outside_local_morning_window" });
      await logOutcome(supabase, prospect.id, member.campaign_id, campaign.channel, "skipped", { reason: "outside_local_morning_window" });
      continue;
    }

    if (campaign.channel === "instantly") {
      const { outcome, reason, draft } = await handleInstantlyFollowUp(supabase, prospect, config);
      results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: reason ? `${outcome}: ${reason}` : outcome });
      await logOutcome(supabase, prospect.id, member.campaign_id, "instantly", outcome, { reason, draft });
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
      results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: "no_draft" });
      await logOutcome(supabase, prospect.id, member.campaign_id, "sarah", "no_draft");
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
    results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: "drafted_for_review" });
    await logOutcome(supabase, prospect.id, member.campaign_id, "sarah", "drafted_for_review", { draft });
  }

  return { sent, drafted, results };
}

async function handleInstantlyFollowUp(
  supabase: SupabaseAny,
  prospect: { id: string; contact_email: string | null; contact_name: string | null },
  config: FollowUpConfig,
): Promise<{ outcome: string; reason?: string; draft?: string | null }> {
  const state = await getLatestThreadState(prospect.contact_email!);
  if (!state || !state.threadId) return { outcome: "skipped", reason: "no_instantly_thread_found" };
  if (state.lastMessageFromLead) return { outcome: "skipped", reason: "lead_spoke_last" };

  const lastMessageAge = Date.now() - new Date(state.lastMessageAt).getTime();
  if (lastMessageAge < STALE_AFTER_MS) return { outcome: "skipped", reason: "not_stale_yet" };
  if (await hasHumanReplied(state.threadId)) return { outcome: "skipped", reason: "human_owns_thread" };

  const { data: recentFollowUp } = await supabase
    .from("audit_log")
    .select("id, created_at")
    .eq("action", "ai_agent_follow_up")
    .contains("after", { thread_id: state.threadId, status: "sent" })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentFollowUp && Date.now() - new Date(recentFollowUp.created_at).getTime() < MIN_GAP_BETWEEN_FOLLOWUPS_MS) {
    return { outcome: "skipped", reason: "followed_up_recently" };
  }

  const draft = await askAI(
    `This prospect showed real interest earlier but has gone quiet since our last message. Write a short, natural follow-up that continues the conversation, it should NOT read like a new cold outreach or a generic "just following up."
Their name: ${prospect.contact_name || 'unknown, do not guess it or use a placeholder, skip the name or use "Hi there"'}
Subject of the thread: ${state.subject}
Days since our last message: ${Math.round(lastMessageAge / 86400000)}

Follow every rule in the guidelines below exactly. Output just the email body, no subject line, no signature block beyond a first-name sign-off.`,
    { system: buildSystemPrompt(config, `You are writing FROM the mailbox ${state.eaccount}.`), maxTokens: 300 },
  );
  if (!draft) return { outcome: "no_draft" };

  const ok = await replyToEmail({
    eaccount: state.eaccount,
    replyToUuid: state.lastMessageId,
    subject: state.subject.startsWith("Re:") ? state.subject : `Re: ${state.subject}`,
    html: toHtml(draft),
  });

  return { outcome: ok ? "sent" : "failed", draft };
}
