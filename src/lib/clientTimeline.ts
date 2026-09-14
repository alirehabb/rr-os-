import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type TimelineEvent = {
  at: string;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "accent";
};

function money(n: number) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// A real, derived activity timeline — built entirely from timestamps that
// already exist on real rows (signed_at, verified_at, sent_at, ...), not a
// generic audit-log feed. Most client-lifecycle actions don't write to
// audit_log today, so that table alone would render a sparse, misleading
// history; this reads the actual domain events instead.
export async function buildClientTimeline(supabase: SupabaseClient<Database>, clientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  const [{ data: client }, { data: handoverItems }, { data: opportunities }, { data: assignments }, { data: invoices }, { data: knowledgeAssignments }] =
    await Promise.all([
      supabase.from("clients").select("signed_at, fulfillment_completed_at, go_live_completed_at").eq("id", clientId).single(),
      supabase.from("handover_items").select("label, reviewed_at").eq("client_id", clientId).not("reviewed_at", "is", null),
      supabase.from("opportunities").select("id, prospect_name, created_at, stage, value").eq("client_id", clientId),
      supabase.from("rep_assignments").select("id, rep_id, created_at, status").eq("client_id", clientId),
      supabase.from("invoices").select("description, amount, sent_at, paid_at, voided_at").eq("client_id", clientId),
      supabase.from("knowledge_assignments").select("assigned_at, knowledge_items(title)").eq("client_id", clientId),
    ]);

  if (client?.signed_at) events.push({ at: client.signed_at, label: "Client signed", tone: "success" });
  if (client?.fulfillment_completed_at) events.push({ at: client.fulfillment_completed_at, label: "Fulfillment marked complete", tone: "success" });
  if (client?.go_live_completed_at) events.push({ at: client.go_live_completed_at, label: "Went live", tone: "success" });

  for (const h of handoverItems ?? []) {
    if (h.reviewed_at) events.push({ at: h.reviewed_at, label: `Handover verified: ${h.label}`, tone: "neutral" });
  }

  const oppIds = (opportunities ?? []).map((o) => o.id);
  for (const o of opportunities ?? []) {
    events.push({ at: o.created_at, label: `Opportunity booked: ${o.prospect_name}`, tone: "neutral" });
    if (o.stage === "won") events.push({ at: o.created_at, label: `Won: ${o.prospect_name}${o.value ? ` (${money(o.value)})` : ""}`, tone: "success" });
    if (o.stage === "lost") events.push({ at: o.created_at, label: `Lost: ${o.prospect_name}`, tone: "danger" });
  }

  const { data: deals } = oppIds.length ? await supabase.from("deals").select("id, opportunity_id, value, status, updated_at").in("opportunity_id", oppIds) : { data: [] };
  const dealIds = (deals ?? []).map((d) => d.id);
  const { data: collections } = dealIds.length
    ? await supabase.from("collections").select("amount, verified_at, reported_at").in("deal_id", dealIds)
    : { data: [] };
  for (const c of collections ?? []) {
    if (c.verified_at) events.push({ at: c.verified_at, label: `Collection verified: ${money(Number(c.amount))}`, tone: "success" });
    else events.push({ at: c.reported_at, label: `Collection reported: ${money(Number(c.amount))}`, tone: "neutral" });
  }

  for (const a of assignments ?? []) {
    events.push({ at: a.created_at, label: `Rep assigned (${a.status})`, tone: "neutral" });
  }

  for (const inv of invoices ?? []) {
    if (inv.sent_at) events.push({ at: inv.sent_at, label: `Invoice sent: ${money(Number(inv.amount))}`, tone: "accent" });
    if (inv.paid_at) events.push({ at: inv.paid_at, label: `Invoice paid: ${money(Number(inv.amount))}`, tone: "success" });
    if (inv.voided_at) events.push({ at: inv.voided_at, label: `Invoice voided: ${money(Number(inv.amount))}`, tone: "danger" });
  }

  for (const ka of knowledgeAssignments ?? []) {
    const title = (ka.knowledge_items as unknown as { title: string } | null)?.title ?? "resource";
    events.push({ at: ka.assigned_at, label: `Resource assigned: ${title}`, tone: "neutral" });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}
