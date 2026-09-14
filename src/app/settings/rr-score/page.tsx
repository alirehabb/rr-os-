import { createClient } from "@/lib/supabase/server";
import { saveRRScoreWeights } from "./actions";
import { PageHeader, Card, Button, Input } from "@/components/ui";

export default async function RRScoreSettingsPage() {
  const supabase = await createClient();
  const { data: config } = await supabase.from("rr_score_config").select("*").limit(1).single();

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-lg px-6 py-10">
        <PageHeader
          title="RR Score Configuration"
          subtitle={config?.configured ? `Configured (v${config.version})` : 'Not configured, leaderboard shows "awaiting configuration"'}
        />

        <form action={saveRRScoreWeights}>
          <Card className="space-y-5">
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
              hint="No real data source yet, weighting this shows as missing on the score, not fabricated"
              defaultValue={config?.weight_call_quality ?? 0}
            />
            <WeightField
              name="weight_client_representation"
              label="Client representation"
              hint="No real data source yet, same as above"
              defaultValue={config?.weight_client_representation ?? 0}
            />
            <WeightField
              name="weight_consistency"
              label="Consistency"
              hint="No real data source yet, same as above"
              defaultValue={config?.weight_consistency ?? 0}
            />
            <Button className="w-full">Save configuration</Button>
          </Card>
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
      <span className="font-medium text-foreground">{label}</span>
      <Input type="number" name={name} step="0.05" min="0" max="1" defaultValue={defaultValue} className="mt-1" />
      <span className="mt-1 block text-xs text-faint">{hint}</span>
    </label>
  );
}
