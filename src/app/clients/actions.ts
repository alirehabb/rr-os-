"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { onboardNewClient } from "@/lib/clientOnboarding";

type ClientLifecycleState = Database["public"]["Enums"]["client_lifecycle_state"];

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

export async function markFulfillmentComplete(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ fulfillment_completed_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("fulfillment_completed_at", null);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}

export async function markGoLiveComplete(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ go_live_completed_at: new Date().toISOString(), lifecycle_state: "live" })
    .eq("id", clientId)
    .is("go_live_completed_at", null);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}
