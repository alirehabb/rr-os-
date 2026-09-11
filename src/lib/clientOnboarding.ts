import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const HANDOVER_CHECKLIST: { category: string; label: string }[] = [
  { category: "offer_economics", label: "Offers, pricing, ticket sizes, payment/financing plans" },
  { category: "buyer_qualification", label: "ICP, fit criteria, pre-qualification flow" },
  { category: "sales_journey", label: "End-to-end sales process and stages" },
  { category: "history", label: "Historical performance, existing pipeline, known objections" },
  { category: "sales_resources", label: "Scripts, playbooks, brand materials, recordings" },
  { category: "delivery_context", label: "Fulfillment expectations and escalation contacts" },
  { category: "operational_access", label: "CRM, calendars, booking links, sales inboxes" },
  { category: "commercial_relationship", label: "RR agreement, attribution rules, payment schedule" },
];

// §8.1/§8.2 — signing creates the canonical Client 360 immediately and seeds
// the Complete Sales Handover checklist plus the 48h fulfillment queue item.
// Shared by manual client creation and RR acquisition prospect conversion so
// both paths produce exactly one account with the same onboarding scaffold.
export async function onboardNewClient(
  supabase: SupabaseClient<Database>,
  { name, workflowType }: { name: string; workflowType: string },
) {
  const { data: client, error } = await supabase
    .from("clients")
    .insert({ name, workflow_type: workflowType, signed_at: new Date().toISOString(), lifecycle_state: "onboarding" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("handover_items").insert(
    HANDOVER_CHECKLIST.map((item) => ({
      client_id: client.id,
      category: item.category,
      label: item.label,
    })),
  );

  await supabase.from("action_items").insert({
    title: `Complete sales handover for ${name}`,
    reason: "Signed client with no handover items reviewed yet. Fulfillment target is 48 elapsed hours from signature.",
    client_id: client.id,
    deadline_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });

  return client.id as string;
}
