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

  const rows = prospects ?? [];
  const stats = [
    { label: "Total", value: rows.length, tone: "neutral" as const },
    { label: "Signed", value: rows.filter((p) => p.stage === "signed").length, tone: "success" as const },
    { label: "Agreement Sent", value: rows.filter((p) => p.stage === "agreement_sent").length, tone: "success" as const },
    { label: "Call Booked", value: rows.filter((p) => p.stage === "call_booked").length, tone: "accent" as const },
    { label: "Follow-Up", value: rows.filter((p) => p.stage === "follow_up").length, tone: "warning" as const },
    { label: "Not Fit / No Show", value: rows.filter((p) => p.stage === "not_fit" || p.stage === "no_show").length, tone: "danger" as const },
  ];
  const statText = { neutral: "text-foreground", success: "text-success", accent: "text-accent", warning: "text-warning", danger: "text-danger" };

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <PageHeader title="RR Acquisition Pipeline" subtitle="Drag a card to move it through the pipeline. Dropping on Signed creates the Client 360 automatically." />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rr-fade-up rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${statText[s.tone]}`}>{s.value}</p>
            </div>
          ))}
        </div>

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
