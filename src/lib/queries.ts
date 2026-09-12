import { createClient } from "@/lib/supabase/server";

export type PulseTotals = {
  cashCollected: number;
  rrEarned: number;
  rrReceived: number;
  rrOutstanding: number;
  activeClients: number;
  activePipelineValue: number;
  projectedRRRevenue: number;
  closeRate: number | null;
  callsBookedThisMonth: number;
};

// §6.1 RR Pulse — cash vs booked revenue vs projections must stay labeled and
// distinct. `demoMode` never blends demo and real rows in one total: when on,
// figures reflect only the demo scenario; when off, only real records.
export async function getPulseTotals(demoMode: boolean): Promise<PulseTotals> {
  const supabase = await createClient();

  const [{ data: collections }, { data: ledger }, { data: clients }, { data: opps }, { data: calls }] = await Promise.all([
    supabase.from("collections").select("amount, status, is_demo").eq("is_demo", demoMode),
    supabase.from("ledger_entries").select("entry_type, amount"),
    supabase.from("clients").select("id, lifecycle_state, rr_rate_basis").eq("is_demo", demoMode),
    supabase.from("opportunities").select("id, stage, value, client_id").eq("is_demo", demoMode),
    supabase.from("calls").select("id, scheduled_at, is_demo").eq("is_demo", demoMode),
  ]);

  const cashCollected = (collections ?? []).filter((c) => c.status === "verified").reduce((s, c) => s + Number(c.amount), 0);
  const rrEarned = (ledger ?? []).filter((l) => l.entry_type === "rr_receivable").reduce((s, l) => s + Number(l.amount), 0);
  const rrReceived = (ledger ?? []).filter((l) => l.entry_type === "rr_received").reduce((s, l) => s + Number(l.amount), 0);
  const rrOutstanding = rrEarned - rrReceived;

  const activeClients = (clients ?? []).filter((c) => c.lifecycle_state === "active").length;
  const clientRateById = new Map((clients ?? []).map((c) => [c.id, (c.rr_rate_basis as { rr_rate?: number } | null)?.rr_rate ?? null]));

  const nonTerminal = (opps ?? []).filter((o) => o.stage !== "won" && o.stage !== "lost");
  const activePipelineValue = nonTerminal.reduce((s, o) => s + Number(o.value ?? 0), 0);

  // §15.4 simple transparent forecast: pipeline value × each client's configured
  // RR rate, assuming every active opportunity closes. Zero where no rate is set.
  const projectedRRRevenue = nonTerminal.reduce((s, o) => {
    const rate = clientRateById.get(o.client_id);
    return s + (rate ? Number(o.value ?? 0) * rate : 0);
  }, 0);

  const attended = (opps ?? []).filter((o) => o.stage === "won" || o.stage === "lost");
  const won = (opps ?? []).filter((o) => o.stage === "won");
  const closeRate = attended.length > 0 ? won.length / attended.length : null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const callsBookedThisMonth = (calls ?? []).filter((c) => new Date(c.scheduled_at) >= startOfMonth).length;

  return { cashCollected, rrEarned, rrReceived, rrOutstanding, activeClients, activePipelineValue, projectedRRRevenue, closeRate, callsBookedThisMonth };
}

// Trailing 14-day daily verified-collection totals for the Cash Collected
// sparkline — real reported_at dates, not a fabricated trend.
export async function getCashCollectedTrend(demoMode: boolean): Promise<number[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 13 * 86400000);
  since.setHours(0, 0, 0, 0);

  const { data: collections } = await supabase
    .from("collections")
    .select("amount, status, verified_at, is_demo")
    .eq("is_demo", demoMode)
    .eq("status", "verified")
    .gte("verified_at", since.toISOString());

  const days: number[] = Array(14).fill(0);
  for (const c of collections ?? []) {
    if (!c.verified_at) continue;
    const dayIndex = Math.floor((new Date(c.verified_at).setHours(0, 0, 0, 0) - since.getTime()) / 86400000);
    if (dayIndex >= 0 && dayIndex < 14) days[dayIndex] += Number(c.amount);
  }
  return days;
}

// Trailing 14-day daily booked-call counts. The other pulse metrics
// (RR Outstanding, Active Pipeline, Projected RR Revenue, Close Rate) are
// point-in-time balances with no stored daily snapshot — a trend for those
// would have to be fabricated, so they intentionally have none.
export async function getCallsBookedTrend(demoMode: boolean): Promise<number[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 13 * 86400000);
  since.setHours(0, 0, 0, 0);

  const { data: calls } = await supabase
    .from("calls")
    .select("scheduled_at, is_demo")
    .eq("is_demo", demoMode)
    .gte("scheduled_at", since.toISOString());

  const days: number[] = Array(14).fill(0);
  for (const c of calls ?? []) {
    const dayIndex = Math.floor((new Date(c.scheduled_at).setHours(0, 0, 0, 0) - since.getTime()) / 86400000);
    if (dayIndex >= 0 && dayIndex < 14) days[dayIndex] += 1;
  }
  return days;
}

export type QueueItem = {
  id: string;
  title: string;
  reason: string;
  status: string;
  priority: number;
  pinned: boolean;
  deadline_at: string | null;
  money_impact: number | null;
  client_id: string | null;
};

// §6.3 Command Queue ordering default: overdue/high-risk first, then approaching
// deadlines and material risk, then routine — with founder pin override.
export async function getCommandQueue(demoMode: boolean): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_items")
    .select("id, title, reason, status, priority, pinned, deadline_at, money_impact, client_id")
    .eq("is_demo", demoMode)
    .in("status", ["open", "in_progress", "waiting"])
    .order("pinned", { ascending: false })
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });

  return data ?? [];
}

export type ClientClockRow = {
  client_id: string | null;
  name: string;
  signed_at: string | null;
  fulfillment_deadline: string | null;
  go_live_deadline: string | null;
  fulfillment_completed_at: string | null;
  go_live_completed_at: string | null;
  fulfillment_breached: boolean | null;
  go_live_breached: boolean | null;
};

// §8.3 fulfillment/go-live clocks, for the client health section of Home.
export async function getClientClocks(demoMode: boolean): Promise<ClientClockRow[]> {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").eq("is_demo", demoMode);
  const clientIds = (clients ?? []).map((c) => c.id);
  const { data: clocks } = clientIds.length
    ? await supabase
        .from("client_clocks")
        .select(
          "client_id, signed_at, fulfillment_deadline, go_live_deadline, fulfillment_completed_at, go_live_completed_at, fulfillment_breached, go_live_breached",
        )
        .in("client_id", clientIds)
    : { data: [] };

  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  return (clocks ?? []).map((c) => ({ ...c, name: nameById.get(c.client_id!) ?? "Unknown" }));
}
