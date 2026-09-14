"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// §6.3 Command Queue states: Open → In Progress → Waiting → Done, plus Snoozed/Cancelled.
export async function completeActionItem(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("action_items").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/");
}

// Plain-argument variant for optimistic client-side calls (CommandQueueClient).
export async function completeActionItemById(id: string) {
  const supabase = await createClient();
  await supabase.from("action_items").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/");
}

// Undo for the Command Queue's "complete" action — reopens it exactly as it
// was, so clearing an item is never a one-way door within the undo window.
export async function reopenActionItemById(id: string) {
  const supabase = await createClient();
  await supabase.from("action_items").update({ status: "open", completed_at: null }).eq("id", id);
  revalidatePath("/");
  revalidatePath("/command-center");
}

export async function snoozeActionItem(formData: FormData) {
  const id = String(formData.get("id"));
  const until = String(formData.get("snoozed_until"));
  const supabase = await createClient();
  await supabase
    .from("action_items")
    .update({ status: "snoozed", snoozed_until: new Date(until).toISOString() })
    .eq("id", id);
  revalidatePath("/");
}

export async function pinActionItem(formData: FormData) {
  const id = String(formData.get("id"));
  const pinned = formData.get("pinned") === "true";
  const supabase = await createClient();
  await supabase.from("action_items").update({ pinned: !pinned }).eq("id", id);
  revalidatePath("/");
}
