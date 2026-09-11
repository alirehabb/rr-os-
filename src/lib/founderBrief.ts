import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type FounderBrief = {
  generatedAt: string;
  yesterdayCallsLogged: number;
  yesterdayCollections: number;
  todaysBookings: number;
  overdueFollowUps: { opportunityId: string; prospectName: string; nextCallAt: string }[];
  neglectedOpportunities: { opportunityId: string; prospectName: string; daysSinceActivity: number }[];
  onboardingBlockers: { clientId: string; clientName: string; blockerCount: number }[];
  approachingDeadlines: { clientId: string; clientName: string; kind: "fulfillment" | "go_live"; deadline: string }[];
  breachedDeadlines: { clientId: string; clientName: string; kind: "fulfillment" | "go_live"; deadline: string }[];
  unpaidRRCommission: number;
  pendingPayouts: number;
  newApplications: number;
  newProspects: number;
  pendingQueueItems: number;
};

// §17.2 — overnight sweep. Every number here is a real query result; if
// nothing happened, the caller renders that honestly rather than inventing
// activity (spec explicitly forbids manufacturing activity).
export async function buildFounderBrief(supabase: SupabaseClient<Database>): Promise<FounderBrief> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [
    { data: yesterdayCalls },
    { data: yesterdayCollections },
    { data: todaysCalls },
    { data: overdueOpps },
    { data: clocks },
    { data: clients },
    { data: ledger },
    { data: pendingWallets },
    { data: applications },
    { data: newProspects },
    { data: queueItems },
  ] = await Promise.all([
    supabase.from("calls").select("id").gte("logged_at", startOfYesterday.toISOString()).lt("logged_at", startOfToday.toISOString()),
    supabase.from("collections").select("amount").gte("reported_at", startOfYesterday.toISOString()).lt("reported_at", startOfToday.toISOString()),
    supabase.from("calls").select("id").gte("scheduled_at", startOfToday.toISOString()).lt("scheduled_at", endOfToday.toISOString()),
    supabase
      .from("opportunities")
      .select("id, prospect_name, stage")
      .in("stage", ["booked", "follow_up"]),
    supabase.from("client_clocks").select("*"),
    supabase.from("clients").select("id, name"),
    supabase.from("ledger_entries").select("client_id, entry_type, amount"),
    supabase.from("wallet_entries").select("amount").in("status", ["payable", "approved"]),
    supabase.from("reps").select("id").eq("recruiting_status", "application"),
    supabase.from("prospects").select("id").gte("created_at", startOfYesterday.toISOString()),
    supabase.from("action_items").select("id").in("status", ["open", "in_progress"]),
  ]);

  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  // overdue follow-up: nonterminal opportunity whose calls all have a past next_call_at
  const oppIds = (overdueOpps ?? []).map((o) => o.id);
  const { data: callsForOverdue } = oppIds.length
    ? await supabase.from("calls").select("opportunity_id, next_call_at").in("opportunity_id", oppIds)
    : { data: [] };

  const overdueFollowUps = (overdueOpps ?? [])
    .map((o) => {
      const calls = (callsForOverdue ?? []).filter((c) => c.opportunity_id === o.id && c.next_call_at);
      const latestNext = calls.map((c) => c.next_call_at!).sort().pop();
      return latestNext && new Date(latestNext) < now
        ? { opportunityId: o.id, prospectName: o.prospect_name, nextCallAt: latestNext }
        : null;
    })
    .filter((x): x is { opportunityId: string; prospectName: string; nextCallAt: string } => x !== null);

  // neglected: follow_up-stage opportunity with no logged call in the last 7 days
  const { data: recentCalls } = oppIds.length
    ? await supabase
        .from("calls")
        .select("opportunity_id, logged_at")
        .in("opportunity_id", oppIds)
        .not("logged_at", "is", null)
    : { data: [] };

  const neglectedOpportunities = (overdueOpps ?? [])
    .filter((o) => o.stage === "follow_up")
    .map((o) => {
      const logs = (recentCalls ?? []).filter((c) => c.opportunity_id === o.id).map((c) => c.logged_at!);
      const latest = logs.sort().pop();
      const daysSince = latest ? Math.floor((now.getTime() - new Date(latest).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return daysSince >= 7 ? { opportunityId: o.id, prospectName: o.prospect_name, daysSinceActivity: daysSince } : null;
    })
    .filter((x): x is { opportunityId: string; prospectName: string; daysSinceActivity: number } => x !== null);

  const { data: handoverBlockers } = await supabase
    .from("handover_items")
    .select("client_id")
    .eq("blocks_readiness", true)
    .not("status", "in", "(verified,not_applicable)");

  const blockerCounts = new Map<string, number>();
  for (const h of handoverBlockers ?? []) {
    blockerCounts.set(h.client_id, (blockerCounts.get(h.client_id) ?? 0) + 1);
  }
  const onboardingBlockers = Array.from(blockerCounts.entries()).map(([clientId, blockerCount]) => ({
    clientId,
    clientName: clientNameById.get(clientId) ?? "Unknown",
    blockerCount,
  }));

  const approachingDeadlines: FounderBrief["approachingDeadlines"] = [];
  const breachedDeadlines: FounderBrief["breachedDeadlines"] = [];
  for (const c of clocks ?? []) {
    if (!c.client_id) continue;
    const clientName = clientNameById.get(c.client_id) ?? "Unknown";
    if (!c.fulfillment_completed_at && c.fulfillment_deadline) {
      if (c.fulfillment_breached) breachedDeadlines.push({ clientId: c.client_id, clientName, kind: "fulfillment", deadline: c.fulfillment_deadline });
      else if (new Date(c.fulfillment_deadline) < soon) approachingDeadlines.push({ clientId: c.client_id, clientName, kind: "fulfillment", deadline: c.fulfillment_deadline });
    }
    if (!c.go_live_completed_at && c.go_live_deadline) {
      if (c.go_live_breached) breachedDeadlines.push({ clientId: c.client_id, clientName, kind: "go_live", deadline: c.go_live_deadline });
      else if (new Date(c.go_live_deadline) < soon) approachingDeadlines.push({ clientId: c.client_id, clientName, kind: "go_live", deadline: c.go_live_deadline });
    }
  }

  const rrReceivable = (ledger ?? []).filter((l) => l.entry_type === "rr_receivable").reduce((s, l) => s + Number(l.amount), 0);
  const rrReceived = (ledger ?? []).filter((l) => l.entry_type === "rr_received").reduce((s, l) => s + Number(l.amount), 0);

  return {
    generatedAt: now.toISOString(),
    yesterdayCallsLogged: (yesterdayCalls ?? []).length,
    yesterdayCollections: (yesterdayCollections ?? []).reduce((s, c) => s + Number(c.amount), 0),
    todaysBookings: (todaysCalls ?? []).length,
    overdueFollowUps,
    neglectedOpportunities,
    onboardingBlockers,
    approachingDeadlines,
    breachedDeadlines,
    unpaidRRCommission: rrReceivable - rrReceived,
    pendingPayouts: (pendingWallets ?? []).reduce((s, w) => s + Number(w.amount), 0),
    newApplications: (applications ?? []).length,
    newProspects: (newProspects ?? []).length,
    pendingQueueItems: (queueItems ?? []).length,
  };
}
