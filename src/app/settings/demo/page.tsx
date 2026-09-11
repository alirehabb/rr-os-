import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Button } from "@/components/ui";
import { enableDemoMode, disableDemoMode } from "./actions";

export default async function DemoDataSettingsPage() {
  const supabase = await createClient();
  const { data: config } = await supabase.from("demo_mode").select("*").limit(1).single();

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <PageHeader
        title="Demo Data Mode"
        subtitle="Populates the OS with a clearly-labeled fictional scenario so every screen can be experienced with realistic data. Never counted in real financial totals — purge it any time."
      />

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">{config?.enabled ? "Demo data is active" : "Demo data is off"}</p>
            <p className="text-sm text-muted">
              {config?.enabled
                ? "Fictional clients, reps, opportunities and queue items are visible across the app, tagged Demo."
                : "Turn it on to populate every screen with a realistic fictional company for testing."}
            </p>
          </div>
        </div>
        <form action={config?.enabled ? disableDemoMode : enableDemoMode} className="mt-4">
          <Button variant={config?.enabled ? "danger" : "primary"} className="w-full">
            {config?.enabled ? "Turn off & purge demo data" : "Turn on demo data"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
