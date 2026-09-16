import { createServiceClient } from "@/lib/supabase/service";
import { runFollowUpForMembers } from "@/lib/followupEngine";

// Opt-in only: this only ever touches a prospect who was explicitly dragged
// into a campaign at /follow-ups — never a blind sweep of every CRM lead at
// a given stage. A campaign's channel decides the trust level:
//   - 'instantly': fully autonomous, replies land in the original thread
//     (same gates as the reactive reply pipeline: human ownership,
//     staleness, once-per-4-days).
//   - 'sarah': never auto-sent — drafted into followup_drafts for review
//     at /follow-ups.
// The actual per-member logic lives in lib/followupEngine.ts, shared with
// the "Run now" manual trigger on a campaign's detail page.
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

  const { sent, drafted, results } = await runFollowUpForMembers(supabase, config, members ?? []);
  return Response.json({ checked: (members ?? []).length, sent, drafted, results });
}
