"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// §21.2 — configuring RR Score weights is an explicit human decision. Two
// components (call_quality, client_representation) have no real data source
// yet (no call-quality scoring exists per §12/§18), so setting their weight
// above zero produces a score that's honest about which parts are estimated
// vs. missing — the UI surfaces that, this action just stores the choice.
export async function saveRRScoreWeights(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const weights = {
    weight_sales_performance: Number(formData.get("weight_sales_performance") ?? 0),
    weight_follow_up_discipline: Number(formData.get("weight_follow_up_discipline") ?? 0),
    weight_call_quality: Number(formData.get("weight_call_quality") ?? 0),
    weight_client_representation: Number(formData.get("weight_client_representation") ?? 0),
    weight_consistency: Number(formData.get("weight_consistency") ?? 0),
  };

  const { data: existing } = await supabase.from("rr_score_config").select("id, version").limit(1).single();

  await supabase
    .from("rr_score_config")
    .update({
      ...weights,
      configured: true,
      configured_by: user?.id,
      configured_at: new Date().toISOString(),
      version: (existing?.version ?? 0) + 1,
    })
    .eq("id", existing!.id);

  revalidatePath("/settings/rr-score");
  revalidatePath("/leaderboard");
}
