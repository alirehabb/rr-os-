import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Single source of truth for "is demo mode on right now" — every list/
// aggregate view on a demo-flaggable table must filter by this so real and
// demo records never render mixed in the same screen.
export async function getDemoMode(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.from("demo_mode").select("enabled").limit(1).single();
  return !!data?.enabled;
}
