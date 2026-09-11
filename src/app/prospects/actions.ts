"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { onboardNewClient } from "@/lib/clientOnboarding";

type ProspectStage = Database["public"]["Enums"]["prospect_stage"];

// §7 — website/Instantly/Calendly/manual intake into RR's own pipeline.
export async function createProspect(formData: FormData) {
  const company_name = String(formData.get("company_name") ?? "").trim();
  const contact_name = String(formData.get("contact_name") ?? "").trim() || null;
  const contact_email = String(formData.get("contact_email") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "manual");
  if (!company_name) throw new Error("Company name is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: prospect, error } = await supabase
    .from("prospects")
    .insert({ company_name, contact_name, contact_email, source, owner_id: user?.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/prospects");
  redirect(`/prospects/${prospect.id}`);
}

// §7 — No Show and Not Fit are explicit outcomes; a missed call doesn't
// terminate the relationship automatically, and a rebooked prospect can
// return to call_booked from either.
export async function updateProspectStage(formData: FormData) {
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage")) as ProspectStage;
  const next_action = String(formData.get("next_action") ?? "").trim() || null;
  const next_action_date = String(formData.get("next_action_date") ?? "");
  const qualification_notes = String(formData.get("qualification_notes") ?? "").trim() || null;
  const proposed_plan = String(formData.get("proposed_plan") ?? "").trim() || null;

  const supabase = await createClient();
  await supabase
    .from("prospects")
    .update({
      stage,
      next_action,
      next_action_date: next_action_date ? new Date(next_action_date).toISOString() : null,
      qualification_notes,
      proposed_plan,
    })
    .eq("id", id);

  revalidatePath(`/prospects/${id}`);
  revalidatePath("/prospects");
}

// §7/§8.1 — signing links to exactly one Client 360 and starts onboarding
// without losing the acquisition history; the prospect record is preserved,
// not deleted or overwritten.
export async function convertProspectToClient(formData: FormData) {
  const prospectId = String(formData.get("prospect_id"));
  const companyName = String(formData.get("company_name"));
  const workflowType = String(formData.get("workflow_type") ?? "closing_only");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("prospects")
    .select("converted_client_id")
    .eq("id", prospectId)
    .single();
  if (existing?.converted_client_id) {
    redirect(`/clients/${existing.converted_client_id}`);
  }

  const clientId = await onboardNewClient(supabase, { name: companyName, workflowType });

  await supabase
    .from("prospects")
    .update({ stage: "signed", converted_client_id: clientId })
    .eq("id", prospectId);

  revalidatePath("/prospects");
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}
