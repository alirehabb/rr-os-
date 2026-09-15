"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveAIAgentConfig(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tone = String(formData.get("tone") ?? "").trim() || null;
  const guidelines = String(formData.get("guidelines") ?? "").trim() || null;
  const knowledge_base = String(formData.get("knowledge_base") ?? "").trim() || null;

  const { data: config } = await supabase.from("ai_agent_config").select("id").limit(1).single();
  if (!config) return;

  await supabase.from("ai_agent_config").update({ tone, guidelines, knowledge_base, updated_by: user?.id }).eq("id", config.id);
  revalidatePath("/settings/ai-agent");
}

// The kill switch is a separate action from the guidelines save so flipping
// it never depends on the rest of the form being filled out correctly, and
// so it's the one thing on this page that can't be fat-fingered as a side
// effect of editing text.
export async function setAutoReplyEnabled(formData: FormData) {
  const supabase = await createClient();
  const enabled = formData.get("enabled") === "true";

  const { data: config } = await supabase.from("ai_agent_config").select("id").limit(1).single();
  if (!config) return;

  await supabase.from("ai_agent_config").update({ auto_reply_enabled: enabled }).eq("id", config.id);
  revalidatePath("/settings/ai-agent");
}
