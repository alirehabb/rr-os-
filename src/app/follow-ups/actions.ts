"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// A human has read the escalated thread and handled it (replied themselves,
// or decided it needs nothing further) — clears the agent's stop flag so it
// resumes normal auto-reply/follow-up on this prospect.
export async function clearHumanReview(prospectId: string) {
  const supabase = await createClient();
  await supabase.from("prospects").update({ needs_human_review: false, human_review_reason: null }).eq("id", prospectId);
  revalidatePath("/follow-ups");
  revalidatePath(`/prospects/${prospectId}`);
}
