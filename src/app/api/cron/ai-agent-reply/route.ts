import { createServiceClient } from "@/lib/supabase/service";
import { getRecentReplies, hasHumanReplied, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";

const ALI_EMAIL = "ali@rehab-revenue.com";

// Stages that mean the conversation has already moved past "interested
// email reply" — a call is booked, in progress, or dead. Rule 9 (Follow-up)
// says stop sales follow-up once booked or rejected; the agent has no
// business drafting anything for these.
const SKIP_STAGES = new Set(["call_booked", "no_show", "call_completed", "follow_up", "not_fit", "agreement_sent", "signed"]);

// Same shared-secret guard as /api/cron/chase. Vercel's schedule below is
// the fastest cron interval available on the current plan — upgrade if the
// business needs the full 5-8 minute response time this was scoped for.
// The real safety gate is ai_agent_config.auto_reply_enabled, checked first
// and defaulting to false: this route is a no-op until a human turns it on
// from /settings/ai-agent, after actually filling in tone/guidelines.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const authOk = auth === `Bearer ${process.env.CRON_SECRET}`;

  // Temporary heartbeat: writes on every single hit to this route, pass or
  // fail, before anything else runs. This is the only way to tell from
  // outside Vercel whether the cron is actually invoking the route at all
  // (as opposed to the route running fine but simply finding nothing fresh
  // to act on every tick). Remove once that's confirmed one way or another.
  try {
    const heartbeatClient = createServiceClient();
    await heartbeatClient.from("audit_log").insert({
      actor_type: "automation",
      action: "ai_agent_cron_heartbeat",
      target_type: "cron",
      after: { auth_ok: authOk, has_secret_env: !!process.env.CRON_SECRET, user_agent: req.headers.get("user-agent") },
    });
  } catch {
    // Heartbeat failing must never block the real handler below.
  }

  if (!authOk) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: config } = await supabase.from("ai_agent_config").select("*").limit(1).single();
  if (!config?.auto_reply_enabled) {
    return Response.json({ skipped: "auto_reply_enabled is off" });
  }

  const replies = await getRecentReplies(20);
  const cutoff = Date.now() - 30 * 60 * 1000;
  const fresh = replies.filter((r) => new Date(r.receivedAt).getTime() > cutoff);

  let sent = 0;
  const results: { replyId: string; outcome: string }[] = [];

  for (const reply of fresh) {
    // A "no_draft"/"failed" outcome is a transient AI or send hiccup, not a
    // real decision — verified live that a Groq call can occasionally
    // return empty on an otherwise-successful request. Only "sent" and
    // deliberate "skipped" gate outcomes count as permanently handled, so a
    // failed attempt gets retried on the next cron run instead of being
    // silently dropped forever.
    const { data: alreadyHandled } = await supabase
      .from("audit_log")
      .select("id")
      .eq("action", "ai_agent_auto_reply")
      .eq("target_id", reply.id)
      .in("after->>status", ["sent", "skipped"])
      .maybeSingle();
    if (alreadyHandled) continue;

    // Rule 2, Human Ownership Override — checked first and overrides
    // everything else. Once Ali has touched a thread, the agent never
    // acts on it again, regardless of what else is true.
    if (await hasHumanReplied(reply.threadId)) {
      await logOutcome(supabase, reply, "skipped", "human_owns_thread");
      results.push({ replyId: reply.id, outcome: "skipped: human_owns_thread" });
      continue;
    }

    // Rule 9, stop sales follow-up once the linked prospect has already
    // booked, progressed, or been marked not a fit.
    const { data: prospect } = await supabase
      .from("prospects")
      .select("stage, contact_name")
      .eq("contact_email", reply.leadEmail)
      .maybeSingle();
    if (prospect && SKIP_STAGES.has(prospect.stage)) {
      await logOutcome(supabase, reply, "skipped", `prospect_stage_${prospect.stage}`);
      results.push({ replyId: reply.id, outcome: `skipped: prospect_stage_${prospect.stage}` });
      continue;
    }

    // Rule 1, the Absolute Reply Gate — classify before ever drafting.
    // Anything short of a clear "interested" is a no-send, flagged for a
    // human to look at rather than guessed at.
    const classification = await askAI(
      `Classify this email reply from a cold outreach recipient. Reply with exactly one word: INTERESTED, NOT_INTERESTED, or UNCLEAR.
INTERESTED = shows genuine commercial interest, asks about pricing/how it works, wants to talk, or is a legitimate follow-up question from someone already engaged.
NOT_INTERESTED = rejection, unsubscribe, hostility, spam complaint, legal threat, vendor pitch, out-of-office/auto-reply, or irrelevant.
UNCLEAR = anything ambiguous that doesn't clearly fit either category.

Email: "${reply.preview}"`,
      // A reasoning model spends part of its token budget on invisible
      // "thinking" tokens before the visible answer. Verified live: 10 was
      // always empty, and even 40 truncated mid-thought on a genuinely
      // ambiguous reply (finish_reason: "length", zero visible content).
      // An empty classification fails safe (treated as not-interested, so
      // it's skipped rather than sent) but that's truncation masquerading
      // as a business decision, not a real UNCLEAR verdict — 80 gives the
      // model enough room to actually finish reasoning before answering.
      { maxTokens: 80 },
    );
    const verdict = (classification ?? "").trim().toUpperCase();
    if (!verdict.startsWith("INTERESTED")) {
      await logOutcome(supabase, reply, "skipped", `classified_${verdict || "no_response"}`);
      results.push({ replyId: reply.id, outcome: `skipped: classified_${verdict || "no_response"}` });
      continue;
    }

    // Rule 3, CC Ali on the FIRST autonomous response in a thread only.
    // thread_id isn't a uuid (Instantly's own id format), so it can't be
    // target_id on this table — it's matched inside the jsonb payload
    // instead, same place every other outcome for this thread gets logged.
    const { data: priorSent } = await supabase
      .from("audit_log")
      .select("id")
      .eq("action", "ai_agent_auto_reply")
      .contains("after", { thread_id: reply.threadId, status: "sent" })
      .maybeSingle();
    const isFirstResponse = !priorSent;

    const draft = await askAI(
      `A prospect replied to our outreach email showing real interest. Write a reply that continues this exact conversation.
Their name: ${prospect?.contact_name || "unknown, do not guess it or use a placeholder, skip the name or use \"Hi there\""}
Their message: "${reply.preview}"

Follow every rule in the guidelines below exactly. Output just the email body, no subject line, no signature block beyond a first-name sign-off.`,
      {
        system: `You are writing FROM the mailbox ${reply.eaccount} — the lead is replying to that person directly, not to "Rehab Revenue" as a company. Tone: ${config.tone ?? "professional, direct, human, 2-6 sentences"}.

GUIDELINES (follow exactly):
${config.guidelines ?? "none set yet"}

KNOWLEDGE BASE:
${config.knowledge_base ?? "none set yet"}

BOOKING LINK: ${config.booking_link ?? "none configured yet"}
${config.booking_link ? `When moving them toward a call, use this exact link: ${config.booking_link}` : "No real booking link exists yet. NEVER invent one or write a placeholder like [INSERT LINK]. If it's time to book a call, say a human will follow up to find a time instead."}

Never use bracket placeholders of any kind (e.g. [Prospect Name], [Company], [INSERT LINK]). If you don't know their name, skip the greeting or use "Hi there" instead of guessing or leaving a blank.

No em dashes. No AI-sounding language.

FINAL OVERRIDE, applies even where the knowledge base above walks through multiple paths: answer only what THIS prospect actually asked. Do not proactively bring up acquisition, lead generation, "full-stack," or any option beyond core performance-based closing unless they explicitly ask about it or state they lack qualified opportunities. When in doubt, say less.`,
        maxTokens: 400,
      },
    );

    let delivery_status: "sent" | "failed" | "no_draft" = "no_draft";
    if (draft) {
      const html = draft
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      const ok = await replyToEmail({
        eaccount: reply.eaccount,
        replyToUuid: reply.id,
        subject: `Re: ${reply.subject}`,
        html,
        cc: isFirstResponse ? [ALI_EMAIL] : undefined,
      });
      delivery_status = ok ? "sent" : "failed";
      if (ok) sent++;
    }

    await logOutcome(supabase, reply, delivery_status, undefined, draft, isFirstResponse);
    results.push({ replyId: reply.id, outcome: delivery_status });
  }

  return Response.json({ checked: fresh.length, sent, results });
}

async function logOutcome(
  supabase: ReturnType<typeof createServiceClient>,
  reply: { id: string; leadEmail: string; eaccount: string; threadId: string },
  status: string,
  reason?: string,
  draft?: string | null,
  ccdAli?: boolean,
) {
  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "ai_agent_auto_reply",
    target_type: "instantly_reply",
    target_id: reply.id,
    after: { eaccount: reply.eaccount, lead: reply.leadEmail, thread_id: reply.threadId, status, reason, draft, ccd_ali: ccdAli },
  });
}
