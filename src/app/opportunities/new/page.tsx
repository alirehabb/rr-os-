import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createOpportunity } from "../actions";
import { getDemoMode } from "@/lib/demoMode";
import { PageHeader, Field, Input, Select, Button, EmptyState } from "@/components/ui";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id } = await searchParams;
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const { data: clients } = await supabase.from("clients").select("id, name").eq("is_demo", demoMode).order("name");

  if (!clients || clients.length === 0) {
    return (
      <div className="flex-1">
        <div className="mx-auto max-w-lg px-6 py-10">
          <PageHeader title="Log a booked call" />
          <EmptyState title="No clients yet" hint="A booked call has to belong to a signed client — sign one first." />
          <Link href="/clients" className="mt-4 inline-block text-sm text-accent underline">
            Go to Clients →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-lg px-6 py-10">
        <PageHeader title="Log a booked call" />
        <form action={createOpportunity} className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm shadow-black/[0.03]">
          <Field label="Client">
            <Select name="client_id" defaultValue={client_id} required className="w-full">
              {clients.map((c) => (
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
