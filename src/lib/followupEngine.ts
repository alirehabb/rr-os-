import { createServiceClient } from "@/lib/supabase/service";
import { getLatestThreadState, getFullThread, hasHumanReplied, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";

// Real incident: a lead who had explicitly replied "not for me" kept
// getting followed up anyway, because campaign membership alone was
// treated as permanent consent to keep nudging — there was no check
// against the CRM stage at all, and no check of what the conversation
// actually said before drafting the next nudge. SKIP_STAGES is the same
// cheap, no-API-call gate the old CRM-wide sweep had before the campaign
// rewrite dropped it.
const SKIP_STAGES = new Set(["call_booked", "no_show", "call_completed", "agreement_sent", "signed", "not_fit"]);

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

// The "CC:"/"To:"/etc. header-line stripping used to live here as a
// one-off fix after a real send included literal "CC: ali@rehab-revenue.com"
// text in the body — it's now handled centrally in askAI() itself so every
// caller gets it, not just this one.

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
// Instantly's real rate limit (20 req/min, confirmed live) plus the ~3.2s
// pacing in lib/instantly.ts means a serverless function has a hard ceiling
// on how many Instantly-touching members it can get through before Vercel's
// own execution timeout hits (Hobby plan: 60s max). At up to 2 Instantly
// calls per candidate, 8 comfortably fits with margin; the ones skipped for
// budget this run get picked up on the next hourly tick, sorted so the
// longest-waiting members go first instead of the same few every time.
const MAX_INSTANTLY_MEMBERS_PER_RUN = 8;

export async function runFollowUpForMembers(supabase: SupabaseAny, config: FollowUpConfig, members: FollowUpMember[]): Promise<{ sent: number; drafted: number; results: FollowUpOutcome[] }> {
  const results: FollowUpOutcome[] = [];
  let sent = 0;
  let drafted = 0;
  let instantlyProcessed = 0;

  const ordered = [...members].sort((a, b) => {
    const at = a.prospects?.last_ai_followup_at ? new Date(a.prospects.last_ai_followup_at).getTime() : 0;
    const bt = b.prospects?.last_ai_followup_at ? new Date(b.prospects.last_ai_followup_at).getTime() : 0;
    return at - bt; // never-run (0) first, then longest-waiting
  });

  for (const member of ordered) {
    const prospect = member.prospects;
    const campaign = member.campaigns;
    if (!prospect || !campaign || !prospect.contact_email) continue;

    if (SKIP_STAGES.has(prospect.stage)) {
      results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: `skipped: stage_${prospect.stage}` });
      await logOutcome(supabase, prospect.id, member.campaign_id, campaign.channel, "skipped", { reason: `stage_${prospect.stage}` });
      continue;
    }
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
      if (instantlyProcessed >= MAX_INSTANTLY_MEMBERS_PER_RUN) {
        results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: "skipped: run_budget_reached_try_next_hour" });
        continue;
      }
      instantlyProcessed++;
      const { outcome, reason, draft } = await handleInstantlyFollowUp(supabase, prospect, config);
      results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: reason ? `${outcome}: ${reason}` : outcome });
      await logOutcome(supabase, prospect.id, member.campaign_id, "instantly", outcome, { reason, draft });
      if (outcome === "sent") {
        sent++;
        await markFollowedUp(supabase, prospect.id);
      }
      continue;
    }

    // 'sarah' channel: draft-only (a human reviews before anything sends),
    // but still worth not drafting at all against a lead who's on record
    // as having declined — same check as the instantly path, just against
    // qualification_notes since there's no thread to read here.
    if (prospect.qualification_notes) {
      const verdict = await askAI(
        `Read these CRM notes on a sales prospect. Do they indicate the prospect has clearly rejected, declined, or asked to stop being contacted? Reply with exactly one word: REJECTED or OPEN.

Notes: ${prospect.qualification_notes}`,
        { maxTokens: 40 },
      );
      if ((verdict ?? "").trim().toUpperCase().startsWith("REJECTED")) {
        await supabase.from("prospects").update({ stage: "not_fit" }).eq("id", prospect.id);
        results.push({ prospectId: prospect.id, lead: prospect.contact_email, outcome: "skipped: prospect_rejected" });
        await logOutcome(supabase, prospect.id, member.campaign_id, "sarah", "skipped", { reason: "prospect_rejected" });
        continue;
      }
    }

    const draft = await askAI(
      `Write a short, natural follow-up email to a prospect in an active outreach campaign.
Company: ${prospect.company_name}
Contact: ${prospect.contact_name ?? "unknown, use a generic greeting, no placeholders"}
Notes on file: ${prospect.qualification_notes ?? "none"}
Source: ${prospect.source ?? "unknown"}

It should read like a real person continuing an existing relationship, not a cold intro. Every follow-up must end with a smooth, low-pressure nudge toward booking a call, not just a question left hanging, use the real booking link if one is configured, otherwise say you'd love to grab 15 minutes and ask when works for them. Output ONLY the email body text, nothing else, no subject line, no "CC:"/"To:"/"Subject:" lines, no signature beyond a first-name sign-off.`,
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

  // Real incident: drafting off the subject line alone produced a generic
  // qualifying question to a lead who'd already offered a specific meeting
  // time and asked detailed questions — the model had no way to know that.
  // Pull the real recent conversation so the follow-up actually engages
  // with what was said, not just the thread title.
  const thread = await getFullThread(prospect.contact_email!);
  const recentContext = thread
    .slice(-6)
    .map((m) => `${m.fromLead ? "Them" : "Us"}: ${m.text.slice(0, 500)}`)
    .join("\n\n");

  // Real incident: a lead who explicitly replied "not for me" kept getting
  // nudged toward a call anyway — nothing here ever checked what was
  // actually said before drafting the next follow-up. This mirrors the
  // reactive pipeline's own classification gate, applied here for the
  // first time.
  if (recentContext) {
    const verdict = await askAI(
      `Read this real conversation with a sales prospect. Has the prospect clearly rejected, declined, or asked to stop being contacted, at any point? Reply with exactly one word: REJECTED or OPEN.

Conversation:
${recentContext}`,
      { maxTokens: 40 },
    );
    if ((verdict ?? "").trim().toUpperCase().startsWith("REJECTED")) {
      await supabase.from("prospects").update({ stage: "not_fit" }).eq("id", prospect.id);
      return { outcome: "skipped", reason: "prospect_rejected" };
    }
  }

  const draft = await askAI(
    `This prospect showed real interest earlier but has gone quiet since our last message. Write a short, natural follow-up that continues the conversation, it should NOT read like a new cold outreach or a generic "just following up." Reference something real from the conversation below if it helps, don't ask something they already answered.
Their name: ${prospect.contact_name || 'unknown, do not guess it or use a placeholder, skip the name or use "Hi there"'}
Days since our last message: ${Math.round(lastMessageAge / 86400000)}

Recent conversation (oldest first):
${recentContext || "(no prior messages found beyond the subject line)"}

Every follow-up must end with a smooth, low-pressure nudge toward booking a call, not just a question left hanging, use the real booking link if one is configured, otherwise ask when a quick 15 minutes would work for them.

Follow every rule in the guidelines below exactly. Output ONLY the email body text, nothing else, no subject line, no "CC:"/"To:"/"Subject:" lines, no signature block beyond a first-name sign-off.`,
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
