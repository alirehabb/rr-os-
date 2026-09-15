import { createServiceClient } from "@/lib/supabase/service";
import { getRecentReplies } from "@/lib/instantly";
import { sendEmail } from "@/lib/email";
import { askAI } from "@/lib/ai";

// Same shared-secret guard as /api/cron/chase. Vercel's schedule below is
// the fastest cron interval available on the current plan — upgrade if the
// business needs the full 5-8 minute response time this was scoped for.
// The real safety gate is ai_agent_config.auto_reply_enabled, checked first
// and defaulting to false: this route is a no-op until a human turns it on
// from /settings/ai-agent, after actually filling in tone/guidelines.
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

  const replies = await getRecentReplies(20);
  const cutoff = Date.now() - 30 * 60 * 1000;
  const fresh = replies.filter((r) => new Date(r.receivedAt).getTime() > cutoff);

  let sent = 0;
  for (const reply of fresh) {
    const { data: alreadyHandled } = await supabase
      .from("audit_log")
      .select("id")
      .eq("action", "ai_agent_auto_reply")
      .eq("target_id", reply.id)
      .maybeSingle();
    if (alreadyHandled) continue;

    const draft = await askAI(
      `Someone replied to our outreach email. Write a short reply.
Their message: ${reply.preview}

Reply in the tone and using the guidelines/knowledge below. Output just the email body, no subject line.`,
      {
        system: `Tone: ${config.tone ?? "friendly, direct, plain English"}. Guidelines: ${config.guidelines ?? "none set"}. Knowledge base: ${config.knowledge_base ?? "none set"}. No em dashes.`,
        maxTokens: 350,
      },
    );

    let delivery_status: "sent" | "failed" | "no_draft" = "no_draft";
    if (draft) {
      const html = draft
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      const ok = await sendEmail({ to: reply.leadEmail, subject: `Re: ${reply.subject}`, html });
      delivery_status = ok ? "sent" : "failed";
      if (ok) sent++;
    }

    await supabase.from("audit_log").insert({
      actor_type: "automation",
      action: "ai_agent_auto_reply",
      target_type: "instantly_reply",
      target_id: reply.id,
      after: { to: reply.leadEmail, draft, delivery_status },
    });
  }

  return Response.json({ checked: fresh.length, sent });
}
