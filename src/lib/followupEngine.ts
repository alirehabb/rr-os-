import { createServiceClient } from "@/lib/supabase/service";
import { getLatestThreadState, getFullThread, hasHumanReplied, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";
import { sendEmail } from "@/lib/email";

// Only "interested" is eligible for the daily nudge — anything past it
// (booked, completed, agreement, won/signed) or dead (no_show, not_fit,
// lost) is either already progressing on its own or a stage the agent has
// no business touching. Checking `stage` here IS the "did they book"
// check: the Calendly webhook (api/webhooks/calendly) flips a prospect to
// call_booked the moment they book, in real time, so there's no separate
// live Calendly poll needed before every follow-up.
const ELIGIBLE_STAGE = "interested";

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
// "Once every day" per the founder's spec, with margin so a cron running a
// few minutes early/late two days running never double-sends.
export const DEDUPE_WINDOW_MS = 22 * 60 * 60 * 1000;
// Best-effort local-morning send window. A prospect without a stored
// timezone (the common case for a cold lead) falls back to a fixed 9am
// Eastern slot per the founder's call, rather than either skipping the
// gate entirely or never getting followed up.
export const LOCAL_HOUR_WINDOW = [9, 12] as const;
const FALLBACK_TIMEZONE = "America/New_York";
const FALLBACK_HOUR_WINDOW = [9, 10] as const;

type SupabaseAny = ReturnType<typeof createServiceClient>;

export function isWithinLocalMorning(timezone: string | null): boolean {
  const [start, end] = timezone ? LOCAL_HOUR_WINDOW : FALLBACK_HOUR_WINDOW;
  try {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone ?? FALLBACK_TIMEZONE, hour: "numeric", hour12: false }).format(new Date()));
    return hour >= start && hour < end;
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
  return `${fromContext} Tone: ${config.tone ?? "professional, direct, human, 2-4 sentences"}.

GUIDELINES (follow exactly, especially the Follow-up section):
${config.guidelines ?? "none set yet"}

KNOWLEDGE BASE, use only what's needed to answer what was actually asked, never dump all of it into one email:
${config.knowledge_base ?? "none set yet"}

BOOKING LINK: ${config.booking_link ?? "none configured yet"}
${config.booking_link ? `If it makes sense to nudge toward a call, use this exact link: ${config.booking_link}` : "No real booking link exists yet. NEVER invent one."}

Keep it short. Two to four sentences. One idea, one soft call to action, never a pushy or salesy tone, never a wall of information. Never use bracket placeholders of any kind. Never manufacture fake urgency. No em dashes. No AI-sounding language.

FINAL OVERRIDE: do not proactively bring up acquisition, lead generation, or "full-stack" unless they previously asked about it. When in doubt, say less.`;
}

export type FollowUpProspect = {
  id: string;
  contact_email: string | null;
  contact_name: string | null;
  company_name: string;
  stage: string;
  source: string | null;
  timezone: string | null;
  qualification_notes: string | null;
  last_ai_followup_at: string | null;
  needs_human_review: boolean;
};

export type FollowUpOutcome = { prospectId: string; lead: string; outcome: string };

async function logOutcome(supabase: SupabaseAny, prospectId: string, lead: string, status: string, extra?: Record<string, unknown>) {
  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "ai_agent_follow_up",
    target_type: "prospect",
    target_id: prospectId,
    after: { lead, status, ...extra },
  });
}

async function markFollowedUp(supabase: SupabaseAny, prospectId: string) {
  await supabase.from("prospects").update({ last_ai_followup_at: new Date().toISOString() }).eq("id", prospectId);
}

// A reply suggests specific times instead of using the booking link, or is
// otherwise ambiguous ("maybe", "let me check with my partner", a question
// the agent has no real answer for) — the founder wants a human in the loop
// for exactly this, not a guess. The agent stops touching the thread and an
// email goes out immediately so nothing sits unanswered.
export async function escalateToHuman(supabase: SupabaseAny, prospect: { id: string; contact_email: string | null; contact_name: string | null; company_name: string }, reason: string, excerpt: string) {
  await supabase.from("prospects").update({ needs_human_review: true, human_review_reason: reason }).eq("id", prospect.id);
  await sendEmail({
    to: ["ali@rehab-revenue.com", "sundeep@ssanzgrowthai.inc"],
    subject: `Needs a human reply: ${prospect.contact_name || prospect.company_name}`,
    html: `<p><strong>${prospect.contact_name || prospect.company_name}</strong> (${prospect.contact_email ?? "no email on file"}) needs a real reply.</p>
<p>Reason: ${reason}</p>
<p>Their message:</p>
<blockquote style="border-left:3px solid #ccc;margin:0;padding-left:12px;color:#444">${excerpt.replace(/\n/g, "<br/>")}</blockquote>
<p>The agent will not touch this thread again until the stage or review flag is cleared in the CRM.</p>`,
  });
  await logOutcome(supabase, prospect.id, prospect.contact_email ?? prospect.company_name, "escalated", { reason, excerpt });
}

// Instantly's real rate limit (20 req/min, confirmed live) plus the ~3.2s
// pacing in lib/instantly.ts means a serverless function has a hard ceiling
// on how many Instantly-touching prospects it can get through before
// Vercel's own execution timeout hits (Hobby plan: 60s max). At up to 2
// Instantly calls per candidate, 8 comfortably fits with margin; anyone
// skipped for budget this run gets picked up on the next hourly tick,
// sorted so the longest-waiting prospects go first instead of the same
// few every time.
const MAX_PER_RUN = 8;

// Runs once an hour over every "interested" Instantly-sourced prospect —
// no opt-in campaign, no drag-and-drop, per the founder's spec: speed to
// lead and pipeline conversion should not depend on someone remembering to
// add a lead to a list. A prospect who has booked, gone dead, or been
// flagged for human review is filtered out by the query itself.
export async function runDailyFollowUps(supabase: SupabaseAny, config: FollowUpConfig): Promise<{ checked: number; sent: number; results: FollowUpOutcome[] }> {
  const { data: candidates } = await supabase
    .from("prospects")
    .select("id, contact_email, contact_name, company_name, stage, source, timezone, qualification_notes, last_ai_followup_at, needs_human_review")
    .eq("stage", ELIGIBLE_STAGE)
    .eq("source", "instantly")
    .eq("needs_human_review", false)
    .not("contact_email", "is", null);

  const ordered = ((candidates ?? []) as FollowUpProspect[]).sort((a, b) => {
    const at = a.last_ai_followup_at ? new Date(a.last_ai_followup_at).getTime() : 0;
    const bt = b.last_ai_followup_at ? new Date(b.last_ai_followup_at).getTime() : 0;
    return at - bt; // never-run (0) first, then longest-waiting
  });

  const results: FollowUpOutcome[] = [];
  let sent = 0;
  let processed = 0;

  for (const prospect of ordered) {
    if (prospect.last_ai_followup_at && Date.now() - new Date(prospect.last_ai_followup_at).getTime() < DEDUPE_WINDOW_MS) {
      results.push({ prospectId: prospect.id, lead: prospect.contact_email!, outcome: "skipped: already_followed_up_today" });
      continue;
    }
    if (!isWithinLocalMorning(prospect.timezone)) {
      results.push({ prospectId: prospect.id, lead: prospect.contact_email!, outcome: "skipped: outside_local_morning_window" });
      continue;
    }
    if (processed >= MAX_PER_RUN) {
      results.push({ prospectId: prospect.id, lead: prospect.contact_email!, outcome: "skipped: run_budget_reached_try_next_hour" });
      continue;
    }
    processed++;

    const { outcome, reason } = await handleInstantlyFollowUp(supabase, prospect, config);
    results.push({ prospectId: prospect.id, lead: prospect.contact_email!, outcome: reason ? `${outcome}: ${reason}` : outcome });
    if (outcome === "sent") {
      sent++;
      await markFollowedUp(supabase, prospect.id);
    }
  }

  return { checked: ordered.length, sent, results };
}

async function handleInstantlyFollowUp(
  supabase: SupabaseAny,
  prospect: FollowUpProspect,
  config: FollowUpConfig,
): Promise<{ outcome: string; reason?: string; draft?: string | null }> {
  const state = await getLatestThreadState(prospect.contact_email!);
  if (!state || !state.threadId) {
    await logOutcome(supabase, prospect.id, prospect.contact_email!, "skipped", { reason: "no_instantly_thread_found" });
    return { outcome: "skipped", reason: "no_instantly_thread_found" };
  }
  if (state.lastMessageFromLead) {
    // They spoke last and we haven't answered yet — that's the reactive
    // reply agent's job, not a follow-up nudge. Leave it alone.
    await logOutcome(supabase, prospect.id, prospect.contact_email!, "skipped", { reason: "lead_spoke_last" });
    return { outcome: "skipped", reason: "lead_spoke_last" };
  }

  const lastMessageAge = Date.now() - new Date(state.lastMessageAt).getTime();
  if (await hasHumanReplied(state.threadId)) {
    await logOutcome(supabase, prospect.id, prospect.contact_email!, "skipped", { reason: "human_owns_thread" });
    return { outcome: "skipped", reason: "human_owns_thread" };
  }

  // Real incident: drafting off the subject line alone produced a generic
  // qualifying question to a lead who'd already offered a specific meeting
  // time and asked detailed questions. Pull the real recent conversation
  // so the follow-up actually engages with what was said.
  const thread = await getFullThread(prospect.contact_email!);
  const recentContext = thread
    .slice(-6)
    .map((m) => `${m.fromLead ? "Them" : "Us"}: ${m.text.slice(0, 500)}`)
    .join("\n\n");

  // Piggyback on this fetch to keep the inbox's snippet cache fresh, same
  // as the manual thread-open path — never a dedicated fetch pass of its own.
  const last = thread[thread.length - 1];
  if (last) {
    await supabase.from("prospects").update({ last_message_preview: last.text.slice(0, 140), last_message_at: last.sentAt }).eq("id", prospect.id);
  }

  if (recentContext) {
    const verdict = await askAI(
      `Read this real conversation with a sales prospect. Reply with exactly one word:
REJECTED — they've clearly declined, said no, or asked to stop being contacted.
NEEDS_HUMAN — they suggested specific meeting times instead of using the booking link, or gave a vague/ambiguous answer (e.g. "maybe", "let me check", a question you can't answer from the conversation alone) that a human should personally handle.
OPEN — anything else, still a normal open conversation.

Conversation:
${recentContext}`,
      { maxTokens: 40 },
    );
    const v = (verdict ?? "").trim().toUpperCase();
    if (v.startsWith("REJECTED")) {
      await supabase.from("prospects").update({ stage: "lost" }).eq("id", prospect.id);
      await logOutcome(supabase, prospect.id, prospect.contact_email!, "skipped", { reason: "prospect_rejected" });
      return { outcome: "skipped", reason: "prospect_rejected" };
    }
    if (v.startsWith("NEEDS_HUMAN")) {
      await escalateToHuman(supabase, prospect, "Suggested specific times or gave a vague answer", recentContext.slice(-1000));
      return { outcome: "skipped", reason: "escalated_to_human" };
    }
  }

  // Not stale enough yet to warrant a nudge, and nothing in the
  // conversation needed escalation — just wait.
  if (lastMessageAge < STALE_AFTER_MS) {
    return { outcome: "skipped", reason: "not_stale_yet" };
  }

  const draft = await askAI(
    `This prospect showed real interest earlier but has gone quiet since our last message. Write a short, natural follow-up that continues the conversation, it should NOT read like a new cold outreach or a generic "just following up." Reference something real from the conversation below if it helps, don't ask something they already answered. Do not be pushy and do not over-explain, keep it brief.
Their name: ${prospect.contact_name || 'unknown, do not guess it or use a placeholder, skip the name or use "Hi there"'}
Days since our last message: ${Math.round(lastMessageAge / 86400000)}

Recent conversation (oldest first):
${recentContext || "(no prior messages found beyond the subject line)"}

End with a smooth, low-pressure nudge toward booking a call, not just a question left hanging, use the real booking link if one is configured, otherwise ask when a quick 15 minutes would work for them.

Follow every rule in the guidelines below exactly. Output ONLY the email body text, nothing else, no subject line, no "CC:"/"To:"/"Subject:" lines, no signature block beyond a first-name sign-off.`,
    { system: buildSystemPrompt(config, `You are writing FROM the mailbox ${state.eaccount}.`), maxTokens: 220 },
  );
  if (!draft) {
    await logOutcome(supabase, prospect.id, prospect.contact_email!, "no_draft");
    return { outcome: "no_draft" };
  }

  const ok = await replyToEmail({
    eaccount: state.eaccount,
    replyToUuid: state.lastMessageId,
    subject: state.subject.startsWith("Re:") ? state.subject : `Re: ${state.subject}`,
    html: toHtml(draft),
  });

  await logOutcome(supabase, prospect.id, prospect.contact_email!, ok ? "sent" : "failed", { draft });
  return { outcome: ok ? "sent" : "failed", draft };
}
