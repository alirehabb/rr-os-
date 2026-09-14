import { createClient } from "@/lib/supabase/server";
import { createProspect } from "./actions";
import { getDemoMode } from "@/lib/demoMode";
import ProspectViews from "./ProspectViews";
import { PageHeader, Button, Input, Select } from "@/components/ui";

export default async function ProspectsPage() {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, company_name, contact_name, contact_email, stage, source, next_action, next_action_date, converted_client_id, is_demo, updated_at")
    .eq("is_demo", demoMode)
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <PageHeader title="RR Acquisition Pipeline" subtitle="Drag a card to move it through the pipeline. Dropping on Signed creates the Client 360 automatically." />

        <form action={createProspect} className="mb-6 flex gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
          <Input name="company_name" required placeholder="Company name" className="flex-1" />
          <Input name="contact_name" placeholder="Contact name" className="flex-1" />
          <Input name="contact_email" type="email" placeholder="Contact email" className="flex-1" />
          <Select name="source">
            <option value="manual">Manual</option>
            <option value="website">Website pre-qual</option>
            <option value="instantly">Instantly</option>
            <option value="calendly">Calendly discovery</option>
          </Select>
          <Button>Add</Button>
        </form>

        <ProspectViews prospects={prospects ?? []} />
      </div>
    </div>
  );
}
