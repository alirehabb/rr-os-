import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ClientReportSnapshot = {
  periodStart: string;
  periodEnd: string;
  bookedCalls: number;
  attended: number;
  noShow: number;
  cancelled: number;
  newOpportunities: number;
  activePipelineValue: number;
  dealsWon: number;
  dealsWonValue: number;
  reportedCollections: number;
  verifiedCollections: number;
  actionsRRIsTaking: { title: string; deadline: string | null }[];
  requiredFromClient: { label: string; status: string }[];
};

// §17.3 — client reports draw only from real records for the stated period.
// Excludes internal-only notes and private founder data by construction
// (this never reads communications or Founder OS tables).
export async function buildClientReportSnapshot(
  supabase: SupabaseClient<Database>,
  clientId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ClientReportSnapshot> {
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, first_booked_at, value, stage")
    .eq("client_id", clientId);

  const oppIds = (opportunities ?? []).map((o) => o.id);

  const { data: calls } = oppIds.length
    ? await supabase
        .from("calls")
        .select("outcome, scheduled_at")
        .in("opportunity_id", oppIds)
        .gte("scheduled_at", startIso)
        .lte("scheduled_at", endIso)
    : { data: [] };

  const { data: deals } = oppIds.length
    ? await supabase
        .from("deals")
        .select("id, value, status, created_at")
        .in("opportunity_id", oppIds)
        .eq("status", "won")
        .gte("created_at", startIso)
        .lte("created_at", endIso)
    : { data: [] };

  const dealIds = (deals ?? []).map((d) => d.id);
  const { data: collections } = dealIds.length
    ? await supabase.from("collections").select("amount, status").in("deal_id", dealIds)
    : { data: [] };

  const { data: openActions } = await supabase
    .from("action_items")
    .select("title, deadline_at")
    .eq("client_id", clientId)
    .in("status", ["open", "in_progress"]);

  const { data: handoverBlockers } = await supabase
    .from("handover_items")
    .select("label, status")
    .eq("client_id", clientId)
    .eq("blocks_readiness", true)
    .neq("status", "verified")
    .neq("status", "not_applicable");

  const newOpportunities = (opportunities ?? []).filter(
    (o) => o.first_booked_at >= startIso && o.first_booked_at <= endIso,
  );
  const activePipeline = (opportunities ?? []).filter((o) => o.stage !== "won" && o.stage !== "lost");

  return {
    periodStart: startIso,
    periodEnd: endIso,
    bookedCalls: (calls ?? []).length,
    attended: (calls ?? []).filter((c) => c.outcome.startsWith("completed")).length,
    noShow: (calls ?? []).filter((c) => c.outcome === "no_show").length,
    cancelled: (calls ?? []).filter((c) => c.outcome === "cancelled").length,
    newOpportunities: newOpportunities.length,
    activePipelineValue: activePipeline.reduce((s, o) => s + Number(o.value ?? 0), 0),
    dealsWon: (deals ?? []).length,
    dealsWonValue: (deals ?? []).reduce((s, d) => s + Number(d.value), 0),
    reportedCollections: (collections ?? []).reduce((s, c) => s + Number(c.amount), 0),
    verifiedCollections: (collections ?? [])
      .filter((c) => c.status === "verified")
      .reduce((s, c) => s + Number(c.amount), 0),
    actionsRRIsTaking: (openActions ?? []).map((a) => ({ title: a.title, deadline: a.deadline_at })),
    requiredFromClient: (handoverBlockers ?? []).map((h) => ({ label: h.label, status: h.status })),
  };
}
