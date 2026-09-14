import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Field, Input, Button } from "@/components/ui";
import { saveFounderTargets } from "./actions";

export default async function FounderTargetsPage() {
  const supabase = await createClient();
  const { data: targets } = await supabase.from("founder_targets").select("*").limit(1).single();

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <PageHeader title="Founder Targets" subtitle="Powers the Founder Progress section on Home. Never fabricated, leave blank to hide." />
      <form action={saveFounderTargets}>
        <Card className="space-y-4">
          <Field label="Monthly RR revenue target ($)">
            <Input name="monthly_revenue_target" type="number" defaultValue={targets?.monthly_revenue_target ?? ""} />
          </Field>
          <Field label="Deals needed this month">
            <Input name="deals_target" type="number" defaultValue={targets?.deals_target ?? ""} />
          </Field>
          <Field label="New clients target this month">
            <Input name="new_clients_target" type="number" defaultValue={targets?.new_clients_target ?? ""} />
          </Field>
          <Button className="w-full">Save targets</Button>
        </Card>
      </form>
    </div>
  );
}
