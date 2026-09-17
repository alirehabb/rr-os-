import { createServiceClient } from "@/lib/supabase/service";
import { runDailyFollowUps } from "@/lib/followupEngine";

// Instantly's rate limit forces real pacing between calls (~3.2s each) —
// the default serverless timeout isn't enough headroom for even the
// engine's own per-run cap. 60s is the max Vercel allows on Hobby.
export const maxDuration = 60;

// Runs hourly over every "interested" Instantly-sourced prospect who hasn't
// booked, gone dead, or been flagged for human review — no opt-in list to
// maintain. See lib/followupEngine.ts for the actual per-prospect gates
// (stale check, rejection/escalation classification, once-a-day dedupe).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: config } = await supabase.from("ai_agent_config").select("*").limit(1).single();
  if (!config?.auto_followup_enabled) {
    return Response.json({ skipped: "auto_followup_enabled is off" });
  }

  const result = await runDailyFollowUps(supabase, config);
  return Response.json(result);
}
