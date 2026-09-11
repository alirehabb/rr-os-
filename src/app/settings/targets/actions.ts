"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveFounderTargets(formData: FormData) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("founder_targets").select("id").limit(1).single();
  if (!existing) return;

  const monthly_revenue_target = formData.get("monthly_revenue_target") ? Number(formData.get("monthly_revenue_target")) : null;
  const deals_target = formData.get("deals_target") ? Number(formData.get("deals_target")) : null;
  const new_clients_target = formData.get("new_clients_target") ? Number(formData.get("new_clients_target")) : null;

  await supabase
    .from("founder_targets")
    .update({ monthly_revenue_target, deals_target, new_clients_target, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  revalidatePath("/");
  revalidatePath("/settings/targets");
}
