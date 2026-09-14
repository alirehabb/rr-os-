"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { onboardNewClient } from "@/lib/clientOnboarding";

type ClientLifecycleState = Database["public"]["Enums"]["client_lifecycle_state"];
type OpportunityStage = Database["public"]["Enums"]["opportunity_stage"];

// §4 client-specific layer — a custom label never changes what the universal
// stage means or how automation acts on it, it only changes what this
// client's own vocabulary calls it.
export async function setClientStageLabel(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const stage = String(formData.get("stage")) as OpportunityStage;
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Label is required");

  const supabase = await createClient();
  await supabase.from("client_stage_labels").upsert({ client_id: clientId, stage, label }, { onConflict: "client_id,stage" });

  // Backfill: opportunities already sitting in this stage should show the
  // new label immediately, not just future transitions.
  await supabase.from("opportunities").update({ custom_stage_label: label }).eq("client_id", clientId).eq("stage", stage);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/opportunities");
}

export async function removeClientStageLabel(formData: FormData) {
  const id = String(formData.get("id"));
  const clientId = String(formData.get("client_id"));
  const stage = String(formData.get("stage")) as OpportunityStage;

  const supabase = await createClient();
  await supabase.from("client_stage_labels").delete().eq("id", id);
  await supabase.from("opportunities").update({ custom_stage_label: null }).eq("client_id", clientId).eq("stage", stage);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/opportunities");
}

// §8.2 — signing creates the canonical account immediately; handover items
// are the Complete Sales Handover checklist, seeded so nothing is invented later.
export async function createClient_(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const workflowType = String(formData.get("workflow_type") ?? "closing_only");
  if (!name) throw new Error("Client name is required");

  const supabase = await createClient();
  const clientId = await onboardNewClient(supabase, { name, workflowType });

  revalidatePath("/clients");
  revalidatePath("/");
  redirect(`/clients/${clientId}`);
}

export async function updateHandoverItemStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const clientId = String(formData.get("client_id"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("handover_items")
    .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/clients/${clientId}`);
}

export async function updateLifecycleState(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const lifecycle_state = String(formData.get("lifecycle_state")) as ClientLifecycleState;

  const supabase = await createClient();
  await supabase.from("clients").update({ lifecycle_state }).eq("id", clientId);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/");
}

// Fulfillment → Talent matching is the next real step, not decoration:
// completing fulfillment with no rep assigned yet immediately raises the
// action the founder actually needs to take, instead of leaving the account
// stalled with no visible next step.
export async function markFulfillmentComplete(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .update({ fulfillment_completed_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("fulfillment_completed_at", null)
    .select("name")
    .single();

  if (client) {
    const { count } = await supabase.from("rep_assignments").select("*", { count: "exact", head: true }).eq("client_id", clientId);
    if (!count) {
      await supabase.from("action_items").insert({
        title: `Match a rep for ${client.name}`,
        reason: "Fulfillment is complete, this account has no rep assigned yet and cannot go live without one.",
        client_id: clientId,
        deadline_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    }
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}

// §8.3 — going live with no active rep is a broken account, not a milestone.
// This enforces the chain instead of just recording a timestamp: fulfillment
// → rep matched → trial reviewed active → THEN live.
export async function markGoLiveComplete(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const supabase = await createClient();

  const { data: activeAssignment } = await supabase
    .from("rep_assignments")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!activeAssignment) {
    const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).single();
    await supabase.from("action_items").insert({
      title: `Cannot go live: ${client?.name ?? "client"} has no active rep`,
      reason: "Go-live was attempted before any rep completed trial review as active. Assign and confirm a rep first.",
      client_id: clientId,
    });
    revalidatePath(`/clients/${clientId}`);
    return;
  }

  await supabase
    .from("clients")
    .update({ go_live_completed_at: new Date().toISOString(), lifecycle_state: "live" })
    .eq("id", clientId)
    .is("go_live_completed_at", null);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}
