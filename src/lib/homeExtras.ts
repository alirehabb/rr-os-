import { createClient } from "@/lib/supabase/server";

export type ClientPulseRow = {
  id: string;
  name: string;
  lifecycleState: string;
  opportunityCount: number;
  expectedRevenue: number;
  rrRevenue: number;
  healthPct: number; // 0-100, derived from breach/blocker signals — not fabricated
  healthLabel: "good" | "watch" | "at_risk";
};

export async function getClientPulse(demoMode: boolean): Promise<ClientPulseRow[]> {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, lifecycle_state, rr_rate_basis")
    .eq("is_demo", demoMode)
    .order("created_at", { ascending: false })
    .limit(6);
  if (!clients?.length) return [];

  const clientIds = clients.map((c) => c.id);
  const [{ data: opps }, { data: clocks }] = await Promise.all([
    supabase.from("opportunities").select("client_id, stage, value").in("client_id", clientIds),
    supabase.from("client_clocks").select("client_id, fulfillment_breached, go_live_breached").in("client_id", clientIds),
  ]);

  const breachedByClient = new Map((clocks ?? []).map((c) => [c.client_id, !!c.fulfillment_breached || !!c.go_live_breached]));

  return clients.map((c) => {
    const clientOpps = (opps ?? []).filter((o) => o.client_id === c.id);
    const active = clientOpps.filter((o) => o.stage !== "won" && o.stage !== "lost");
    const expectedRevenue = active.reduce((s, o) => s + Number(o.value ?? 0), 0);
    const rate = (c.rr_rate_basis as { rr_rate?: number } | null)?.rr_rate ?? 0;
    const rrRevenue = expectedRevenue * rate;

    const breached = breachedByClient.get(c.id) ?? false;
    const healthPct = breached ? 25 : c.lifecycle_state === "paused" || c.lifecycle_state === "churned" ? 10 : c.lifecycle_state === "active" ? 90 : 60;
    const healthLabel = healthPct >= 75 ? "good" : healthPct >= 40 ? "watch" : "at_risk";

    return { id: c.id, name: c.name, lifecycleState: c.lifecycle_state, opportunityCount: clientOpps.length, expectedRevenue, rrRevenue, healthPct, healthLabel };
  });
}

export type FeedItem = { id: string; label: string; detail: string; at: string; kind: "payment" | "call" | "client" | "rep" };

export async function getLiveFeed(demoMode: boolean): Promise<FeedItem[]> {
  const supabase = await createClient();
  const [{ data: collections }, { data: calls }, { data: clients }, { data: assignments }] = await Promise.all([
    supabase.from("collections").select("id, amount, status, verified_at").eq("is_demo", demoMode).eq("status", "verified").not("verified_at", "is", null),
    supabase.from("calls").select("id, outcome, logged_at, opportunity_id").eq("is_demo", demoMode).not("logged_at", "is", null),
    supabase.from("clients").select("id, name, signed_at").eq("is_demo", demoMode).not("signed_at", "is", null),
    supabase.from("rep_assignments").select("id, client_id, role, created_at"),
  ]);

  const items: FeedItem[] = [];
  for (const c of collections ?? []) {
    items.push({ id: `col-${c.id}`, label: "Payment received", detail: `$${Number(c.amount).toLocaleString()}`, at: c.verified_at!, kind: "payment" });
  }
  for (const c of calls ?? []) {
    items.push({ id: `call-${c.id}`, label: "Call completed", detail: c.outcome.replace(/_/g, " "), at: c.logged_at!, kind: "call" });
  }
  for (const c of clients ?? []) {
    items.push({ id: `client-${c.id}`, label: "Client signed", detail: c.name, at: c.signed_at!, kind: "client" });
  }
  for (const a of assignments ?? []) {
    items.push({ id: `assign-${a.id}`, label: "Rep assigned", detail: a.role, at: a.created_at, kind: "rep" });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

export type TodayItem = { id: string; time: string; label: string; detail: string; done: boolean };

export async function getToday(demoMode: boolean): Promise<TodayItem[]> {
  const supabase = await createClient();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);

  const [{ data: calls }, { data: actions }] = await Promise.all([
    supabase
      .from("calls")
      .select("id, scheduled_at, outcome, opportunity_id")
      .eq("is_demo", demoMode)
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString()),
    supabase
      .from("action_items")
      .select("id, title, deadline_at, status")
      .eq("is_demo", demoMode)
      .gte("deadline_at", start.toISOString())
      .lt("deadline_at", end.toISOString()),
  ]);

  const oppIds = (calls ?? []).map((c) => c.opportunity_id);
  const { data: opps } = oppIds.length ? await supabase.from("opportunities").select("id, prospect_name").in("id", oppIds) : { data: [] };
  const oppNameById = new Map((opps ?? []).map((o) => [o.id, o.prospect_name]));

  const items: TodayItem[] = [
    ...(calls ?? []).map((c) => ({
      id: `call-${c.id}`,
      time: c.scheduled_at,
      label: "Client call",
      detail: oppNameById.get(c.opportunity_id) ?? "Opportunity",
      done: c.outcome !== "pending",
    })),
    ...(actions ?? []).map((a) => ({
      id: `action-${a.id}`,
      time: a.deadline_at!,
      label: "Task due",
      detail: a.title,
      done: a.status === "done",
    })),
  ];

  return items.sort((a, b) => a.time.localeCompare(b.time));
}
