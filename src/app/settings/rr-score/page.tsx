import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { saveRRScoreWeights } from "./actions";

export default async function RRScoreSettingsPage() {
  const supabase = await createClient();
  const { data: config } = await supabase.from("rr_score_config").select("*").limit(1).single();

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold">RR Score Configuration</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {config?.configured ? `Configured (v${config.version})` : "Not configured — leaderboard shows \"awaiting configuration\""}
        </p>

        <form action={saveRRScoreWeights} className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <WeightField
            name="weight_sales_performance"
            label="Sales performance"
            hint="Real signal: close rate"
            defaultValue={config?.weight_sales_performance ?? 0}
          />
          <WeightField
            name="weight_follow_up_discipline"
            label="Follow-up discipline"
            hint="Real signal: % of nonterminal opportunities with an agreed next action"
            defaultValue={config?.weight_follow_up_discipline ?? 0}
          />
          <WeightField
            name="weight_call_quality"
            label="Call quality"
            hint="No real data source yet — weighting this shows as missing on the score, not fabricated"
            defaultValue={config?.weight_call_quality ?? 0}
          />
          <WeightField
            name="weight_client_representation"
            label="Client representation"
            hint="No real data source yet — same as above"
            defaultValue={config?.weight_client_representation ?? 0}
          />
          <WeightField
            name="weight_consistency"
            label="Consistency"
            hint="Real signal: activity spread across the period (calls logged weekly vs. clustered)"
            defaultValue={config?.weight_consistency ?? 0}
          />
          <button className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">
            Save configuration
          </button>
        </form>
      </div>
    </div>
  );
}

function WeightField({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        name={name}
        step="0.05"
        min="0"
        max="1"
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
      />
      <span className="mt-1 block text-xs text-neutral-500">{hint}</span>
    </label>
  );
}
