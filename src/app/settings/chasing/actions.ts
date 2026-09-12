"use server";

import { createClient } from "@/lib/supabase/server";
import { runAutomaticChasing } from "@/lib/chasing";
import { revalidatePath } from "next/cache";

export async function runChasingNow() {
  const supabase = await createClient();
  const result = await runAutomaticChasing(supabase);
  revalidatePath("/settings/chasing");
  revalidatePath("/command-center");
  return result;
}
