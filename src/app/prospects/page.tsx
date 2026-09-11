import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { createProspect } from "./actions";
import { PageHeader, LinkCard, Badge, Button, Input, Select, EmptyState } from "@/components/ui";

const STAGE_TONE = {
  lead: "neutral",
  interested: "accent",
  call_booked: "accent",
  call_completed: "accent",
  follow_up: "warning",
  agreement_sent: "warning",
  signed: "success",
  no_show: "danger",
  not_fit: "danger",
} as const;

export default async function ProspectsPage() {
  const supabase = await createClient();
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, company_name, stage, source, next_action_date")
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader title="RR Acquisition Pipeline" />

        <form action={createProspect} className="mb-8 flex gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
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

        <ul className="space-y-2">
          {(prospects ?? []).map((p) => (
            <li key={p.id}>
              <LinkCard href={`/prospects/${p.id}`} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{p.company_name}</p>
                  <p className="text-sm text-muted">{p.source}</p>
                </div>
                <Badge tone={STAGE_TONE[p.stage]}>{p.stage.replace(/_/g, " ")}</Badge>
              </LinkCard>
            </li>
          ))}
          {(prospects ?? []).length === 0 && <EmptyState title="No prospects yet." />}
        </ul>
      </div>
    </div>
  );
}
