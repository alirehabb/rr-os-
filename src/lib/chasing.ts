import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { slackPostMessage } from "@/lib/slack";

// Automatic chasing — real (non-demo) records only, since this posts to a
// real Slack channel. Idempotent: each overdue condition gets exactly one
// open action_item per target, checked before creating another, so running
// this repeatedly (via cron or manually) never spams duplicates.
//
// Scoped to internal notification (founder/reps) only. Client-facing email
// chasing (e.g. "your handover info is overdue") is NOT implemented: the
// clients table has no contact_email column and no real client contact data
// exists to send to — inventing one would mean emailing a fabricated
// address. That needs a real schema field and real contact data first.
export async function runAutomaticChasing(supabase: SupabaseClient<Database>) {
  const created: string[] = [];
  const now = new Date();

  async function ensureActionItem(params: {
    title: string;
    reason: string;
    clientId?: string | null;
    repId?: string | null;
    opportunityId?: string | null;
    deadlineAt?: string | null;
    moneyImpact?: number | null;
  }) {
    const { data: existing } = await supabase
      .from("action_items")
      .select("id")
      .eq("title", params.title)
      .eq("is_demo", false)
      .in("status", ["open", "in_progress"])
      .maybeSingle();
    if (existing) return false;

    await supabase.from("action_items").insert({
      title: params.title,
      reason: params.reason,
      client_id: params.clientId ?? null,
      rep_id: params.repId ?? null,
      opportunity_id: params.opportunityId ?? null,
      deadline_at: params.deadlineAt ?? null,
      money_impact: params.moneyImpact ?? null,
      is_demo: false,
    });
    return true;
  }

  // 1. Overdue follow-ups — opportunity in follow_up with a passed next_call_at.
  const { data: followUpOpps } = await supabase
    .from("opportunities")
    .select("id, prospect_name, owner_rep_id, client_id")
    .eq("is_demo", false)
    .eq("stage", "follow_up");
  for (const opp of followUpOpps ?? []) {
    const { data: latestCall } = await supabase
      .from("calls")
      .select("next_call_at")
      .eq("opportunity_id", opp.id)
      .not("next_call_at", "is", null)
      .order("next_call_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestCall?.next_call_at && new Date(latestCall.next_call_at) < now) {
      const madeNew = await ensureActionItem({
        title: `Overdue follow-up: ${opp.prospect_name}`,
        reason: `No call logged since the agreed follow-up date (${new Date(latestCall.next_call_at).toLocaleDateString()}).`,
        clientId: opp.client_id,
        repId: opp.owner_rep_id,
        opportunityId: opp.id,
      });
      if (madeNew) created.push(`Overdue follow-up: ${opp.prospect_name}`);
    }
  }

  // 2. Handover blockers on a client whose fulfillment deadline has breached.
  const { data: breachedClients } = await supabase.from("client_clocks").select("client_id").eq("fulfillment_breached", true);
  const breachedIds = (breachedClients ?? []).map((c) => c.client_id).filter((id): id is string => !!id);
  if (breachedIds.length) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", breachedIds).eq("is_demo", false);
    const { data: blockers } = await supabase
      .from("handover_items")
      .select("client_id")
      .in("client_id", breachedIds)
      .eq("blocks_readiness", true)
      .not("status", "in", "(verified,not_applicable)");
    const blockerCountByClient = new Map<string, number>();
    for (const b of blockers ?? []) blockerCountByClient.set(b.client_id, (blockerCountByClient.get(b.client_id) ?? 0) + 1);

    for (const client of clients ?? []) {
      const count = blockerCountByClient.get(client.id) ?? 0;
      if (count === 0) continue;
      const madeNew = await ensureActionItem({
        title: `Fulfillment breached: ${client.name}`,
        reason: `${count} handover item(s) still blocking readiness past the 48h fulfillment target.`,
        clientId: client.id,
      });
      if (madeNew) created.push(`Fulfillment breached: ${client.name}`);
    }
  }

  // 3. Rep trial reviews overdue.
  const { data: overdueTrials } = await supabase.from("rep_trial_clocks").select("rep_assignment_id, rep_id, client_id").eq("trial_review_overdue", true);
  for (const t of overdueTrials ?? []) {
    if (!t.rep_id || !t.client_id) continue;
    const [{ data: rep }, { data: client }] = await Promise.all([
      supabase.from("reps").select("full_name").eq("id", t.rep_id).eq("is_demo", false).maybeSingle(),
      supabase.from("clients").select("name").eq("id", t.client_id).eq("is_demo", false).maybeSingle(),
    ]);
    if (!rep || !client) continue;
    const madeNew = await ensureActionItem({
      title: `Trial review overdue: ${rep.full_name} on ${client.name}`,
      reason: "7-day live trial has passed its review date with no confirmed/bench/removed decision.",
      repId: t.rep_id,
      clientId: t.client_id,
    });
    if (madeNew) created.push(`Trial review overdue: ${rep.full_name} on ${client.name}`);
  }

  if (created.length > 0) {
    try {
      await slackPostMessage(`*Automatic chasing* found ${created.length} new overdue item(s):\n${created.map((c) => `• ${c}`).join("\n")}`);
    } catch {
      // Slack not connected/configured — the action items still exist in
      // Command Center either way, so chasing degrades gracefully.
    }
  }

  return { checked: (followUpOpps?.length ?? 0) + breachedIds.length + (overdueTrials?.length ?? 0), created };
}
