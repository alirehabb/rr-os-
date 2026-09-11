import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { createOpportunity } from "../actions";
import { PageHeader, Field, Input, Select, Button } from "@/components/ui";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-lg px-6 py-10">
        <PageHeader title="Log a booked call" />
        <form action={createOpportunity} className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm shadow-black/[0.03]">
          <Field label="Client">
            <Select name="client_id" defaultValue={client_id} required className="w-full">
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prospect name">
            <Input name="prospect_name" required />
          </Field>
          <Field label="Prospect contact (email/phone)">
            <Input name="prospect_contact" />
          </Field>
          <Field label="Source">
            <Input name="source" placeholder="e.g. Calendly, referral" />
          </Field>
          <Field label="Scheduled call time">
            <Input type="datetime-local" name="scheduled_at" required />
          </Field>
          <Button type="submit" className="w-full">
            Create opportunity
          </Button>
        </form>
      </div>
    </div>
  );
}
