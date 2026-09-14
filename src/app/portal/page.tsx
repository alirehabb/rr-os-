import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader, SectionTitle, Card, Badge, EmptyState } from "@/components/ui";

const LIFECYCLE_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  access_pending: "Waiting on access",
  fulfillment: "In fulfillment",
  rep_training_trial: "Rep in training/trial",
  live: "Live",
  active: "Active",
  paused: "Paused",
  churned: "Churned",
};

const LIFECYCLE_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  onboarding: "neutral",
  access_pending: "warning",
  fulfillment: "warning",
  rep_training_trial: "accent",
  live: "accent",
  active: "success",
  paused: "warning",
  churned: "danger",
};

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// §4 client workspace — deliberately narrow: only this client's own account,
// never company-wide numbers or other clients' data. RLS enforces this at
// the database level (client_scoped_* policies), this page just presents it.
export default async function ClientPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myRoles } = await supabase.from("user_roles").select("role, client_id").eq("user_id", user.id);
  const clientRole = (myRoles ?? []).find((r) => r.role === "client" && r.client_id);
  if (!clientRole?.client_id) {
    return (
      <div className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <PageHeader title="Your account" />
          <EmptyState title="No account linked yet." hint="Ask Rehab Revenue to link your login to your account." />
        </div>
      </div>
    );
  }

  const clientId = clientRole.client_id;

  const [{ data: client }, { data: handoverItems }, { data: actionItems }, { data: ledger }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase.from("handover_items").select("*").eq("client_id", clientId),
    supabase
      .from("action_items")
      .select("*")
      .eq("client_id", clientId)
      .in("status", ["open", "in_progress"])
      .order("priority", { ascending: false }),
    supabase.from("ledger_entries").select("entry_type, amount").eq("client_id", clientId),
  ]);

  if (!client) redirect("/login");

  const handoverDone = (handoverItems ?? []).filter((h) => h.reviewed_at).length;
  const handoverTotal = (handoverItems ?? []).length;

  const cashCollected = (ledger ?? [])
    .filter((l) => l.entry_type === "rr_receivable")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          title={client.name}
          subtitle="Your account with Rehab Revenue"
          action={<Badge tone={LIFECYCLE_TONE[client.lifecycle_state]}>{LIFECYCLE_LABEL[client.lifecycle_state]}</Badge>}
        />

        {client.lifecycle_state === "onboarding" && handoverTotal > 0 && (
          <Card className="mb-6 text-sm">
            <p className="font-medium text-foreground">Onboarding checklist</p>
            <p className="mt-1 text-muted">
              {handoverDone} of {handoverTotal} items complete
            </p>
          </Card>
        )}

        <section className="mb-6">
          <SectionTitle>Action needed</SectionTitle>
          <ul className="space-y-2">
            {(actionItems ?? []).map((a) => (
              <li key={a.id}>
                <Card className="text-sm">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="mt-1 text-xs text-muted">{a.reason}</p>
                  {a.deadline_at && <p className="mt-1 text-xs text-faint">Due {new Date(a.deadline_at).toLocaleDateString()}</p>}
                </Card>
              </li>
            ))}
            {(actionItems ?? []).length === 0 && <EmptyState title="Nothing needs your attention right now." />}
          </ul>
        </section>

        <section>
          <SectionTitle>Revenue Rehab has driven</SectionTitle>
          <Card className="text-sm">
            <p className="text-2xl font-semibold text-foreground">{money(cashCollected)}</p>
            <p className="mt-1 text-xs text-faint">Total RR revenue recognized to date</p>
          </Card>
        </section>
      </div>
    </div>
  );
}
