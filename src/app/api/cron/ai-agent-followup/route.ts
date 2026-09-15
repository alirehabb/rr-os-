import { createServiceClient } from "@/lib/supabase/service";
import { getLatestThreadState, hasHumanReplied, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";

const ALI_EMAIL = "ali@rehab-revenue.com";

// Rule 9, Follow-up — the reactive pipeline (ai-agent-reply) only fires when
// a lead replies. This is the other half: interested prospects who WENT
// QUIET after our last message get a real follow-up instead of silence.
// "Interested but stalled" means: stage is still interested (never
// progressed to booked/lost), and the last message in their real Instantly
// thread was FROM us, sent long enough ago that a nudge makes sense.
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const MIN_GAP_BETWEEN_FOLLOWUPS_MS = 4 * 24 * 60 * 60 * 1000; // don't nag daily

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
    .select("id, contact_email, contact_name, stage")
    .eq("stage", "interested")
    .eq("is_demo", false)
    .not("contact_email", "is", null);

  const results: { lead: string; outcome: string }[] = [];
  let sent = 0;

  for (const prospect of prospects ?? []) {
    const state = await getLatestThreadState(prospect.contact_email!);
    if (!state || !state.threadId) {
      results.push({ lead: prospect.contact_email!, outcome: "skipped: no_instantly_thread_found" });
      continue;
    }

    // They spoke most recently, not us — that's the reactive pipeline's
    // job (or genuinely awaiting our reply), not a follow-up situation.
    if (state.lastMessageFromLead) {
      results.push({ lead: prospect.contact_email!, outcome: "skipped: lead_spoke_last" });
      continue;
    }

    const lastMessageAge = Date.now() - new Date(state.lastMessageAt).getTime();
    if (lastMessageAge < STALE_AFTER_MS) {
      results.push({ lead: prospect.contact_email!, outcome: "skipped: not_stale_yet" });
      continue;
    }

    if (await hasHumanReplied(state.threadId)) {
      await logOutcome(supabase, prospect.contact_email!, state, "skipped", "human_owns_thread");
      results.push({ lead: prospect.contact_email!, outcome: "skipped: human_owns_thread" });
      continue;
    }

    const { data: recentFollowUp } = await supabase
      .from("audit_log")
      .select("id, created_at")
      .eq("action", "ai_agent_follow_up")
      .contains("after", { thread_id: state.threadId, status: "sent" })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentFollowUp && Date.now() - new Date(recentFollowUp.created_at).getTime() < MIN_GAP_BETWEEN_FOLLOWUPS_MS) {
      results.push({ lead: prospect.contact_email!, outcome: "skipped: followed_up_recently" });
      continue;
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
      {
        system: `You are writing FROM the mailbox ${state.eaccount}. Tone: ${config.tone ?? "professional, direct, human, 2-6 sentences"}.

GUIDELINES (follow exactly, especially the Follow-up section):
${config.guidelines ?? "none set yet"}

KNOWLEDGE BASE:
${config.knowledge_base ?? "none set yet"}

BOOKING LINK: ${config.booking_link ?? "none configured yet"}
${config.booking_link ? `If it makes sense to nudge toward a call, use this exact link: ${config.booking_link}` : "No real booking link exists yet. NEVER invent one."}

Never use bracket placeholders of any kind. Never manufacture fake urgency or pretend anyone personally reviewed something they didn't. No em dashes. No AI-sounding language.

FINAL OVERRIDE: do not proactively bring up acquisition, lead generation, or "full-stack" unless they previously asked about it. When in doubt, say less.`,
        maxTokens: 300,
      },
    );

    let delivery_status: "sent" | "failed" | "no_draft" = "no_draft";
    if (draft) {
      const html = draft
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      const ok = await replyToEmail({
        eaccount: state.eaccount,
        replyToUuid: state.lastMessageId,
        subject: state.subject.startsWith("Re:") ? state.subject : `Re: ${state.subject}`,
        html,
        cc: isFirstResponse ? [ALI_EMAIL] : undefined,
      });
      delivery_status = ok ? "sent" : "failed";
      if (ok) sent++;
    }

    await logOutcome(supabase, prospect.contact_email!, state, delivery_status, undefined, draft, isFirstResponse);
    results.push({ lead: prospect.contact_email!, outcome: delivery_status });
  }

  return Response.json({ checked: (prospects ?? []).length, sent, results });
}

async function logOutcome(
  supabase: ReturnType<typeof createServiceClient>,
  lead: string,
  state: { threadId: string; eaccount: string },
  status: string,
  reason?: string,
  draft?: string | null,
  ccdAli?: boolean,
) {
  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "ai_agent_follow_up",
    target_type: "instantly_thread",
    after: { eaccount: state.eaccount, lead, thread_id: state.threadId, status, reason, draft, ccd_ali: ccdAli },
  });
}
