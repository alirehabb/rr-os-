import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { createClient_ } from "./actions";
import { PageHeader, LinkCard, Badge, Button, Input, Select, EmptyState } from "@/components/ui";

const LIFECYCLE_TONE = {
  onboarding: "neutral",
  access_pending: "warning",
  fulfillment: "warning",
  rep_training_trial: "accent",
  live: "accent",
  active: "success",
  paused: "warning",
  churned: "danger",
} as const;

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, lifecycle_state, workflow_type, signed_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader title="Clients" />

        <form action={createClient_} className="mb-8 flex gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
          <Input name="name" required placeholder="Client name" className="flex-1" />
          <Select name="workflow_type">
            <option value="closing_only">Closing only</option>
            <option value="setting_enabled">Setting enabled</option>
            <option value="azgari">Azgari (broker/candidate)</option>
          </Select>
          <Button type="submit">Sign new client</Button>
        </form>

        <ul className="space-y-2">
          {(clients ?? []).map((c) => (
            <li key={c.id}>
              <LinkCard href={`/clients/${c.id}`} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{c.name}</p>
                  <p className="text-sm text-muted">{c.workflow_type.replace("_", " ")}</p>
                </div>
                <Badge tone={LIFECYCLE_TONE[c.lifecycle_state]}>{c.lifecycle_state.replace(/_/g, " ")}</Badge>
              </LinkCard>
            </li>
          ))}
          {(clients ?? []).length === 0 && <EmptyState title="No clients yet" hint="Sign your first one above." />}
        </ul>
      </div>
    </div>
  );
}
