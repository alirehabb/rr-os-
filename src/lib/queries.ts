import { createClient } from "@/lib/supabase/server";

export type PulseTotals = {
  cashCollected: number;
  rrEarned: number;
  rrReceived: number;
  rrOutstanding: number;
  activeClients: number;
  activePipelineValue: number;
  closeRate: number | null;
};

// §6.1 RR Pulse — cash vs booked revenue vs projections must stay labeled and distinct.
export async function getPulseTotals(): Promise<PulseTotals> {
  const supabase = await createClient();

  const [{ data: verifiedCollections }, { data: ledger }, { data: clients }, { data: opps }] =
    await Promise.all([
      supabase.from("collections").select("amount").eq("status", "verified"),
      supabase.from("ledger_entries").select("entry_type, amount"),
      supabase.from("clients").select("id, lifecycle_state"),
      supabase.from("opportunities").select("id, stage, value"),
    ]);

  const cashCollected = (verifiedCollections ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const rrEarned = (ledger ?? [])
    .filter((l) => l.entry_type === "rr_receivable")
    .reduce((s, l) => s + Number(l.amount), 0);
  const rrReceived = (ledger ?? [])
    .filter((l) => l.entry_type === "rr_received")
    .reduce((s, l) => s + Number(l.amount), 0);
  const rrOutstanding = rrEarned - rrReceived;

  const activeClients = (clients ?? []).filter((c) => c.lifecycle_state === "active").length;

  const nonTerminal = (opps ?? []).filter((o) => o.stage !== "won" && o.stage !== "lost");
  const activePipelineValue = nonTerminal.reduce((s, o) => s + Number(o.value ?? 0), 0);

  const attended = (opps ?? []).filter((o) => o.stage === "won" || o.stage === "lost");
  const won = (opps ?? []).filter((o) => o.stage === "won");
  const closeRate = attended.length > 0 ? won.length / attended.length : null;

  return { cashCollected, rrEarned, rrReceived, rrOutstanding, activeClients, activePipelineValue, closeRate };
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
export async function getCommandQueue(): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_items")
    .select("id, title, reason, status, priority, pinned, deadline_at, money_impact, client_id")
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
export async function getClientClocks(): Promise<ClientClockRow[]> {
  const supabase = await createClient();
  const { data: clocks } = await supabase
    .from("client_clocks")
    .select(
      "client_id, signed_at, fulfillment_deadline, go_live_deadline, fulfillment_completed_at, go_live_completed_at, fulfillment_breached, go_live_breached",
    );
  const { data: clients } = await supabase.from("clients").select("id, name");

  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  return (clocks ?? []).map((c) => ({ ...c, name: nameById.get(c.client_id!) ?? "Unknown" }));
}
