import { createClient } from "@/lib/supabase/server";
import {
  recordCollection,
  verifyCollection,
  approvePayout,
  markPayablePendingToPayable,
  recordPayoutPaid,
  setClientRateBasis,
} from "./actions";
import { PageHeader, SectionTitle, Card, Badge, Button, Input, EmptyState } from "@/components/ui";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function FinancePage() {
  const supabase = await createClient();

  const [{ data: deals }, { data: collections }, { data: clients }, { data: opportunities }, { data: reps }, { data: wallets }] =
    await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("collections").select("*").order("reported_at", { ascending: false }),
      supabase.from("clients").select("id, name, rr_rate_basis"),
      supabase.from("opportunities").select("id, prospect_name, client_id"),
      supabase.from("reps").select("id, full_name"),
      supabase.from("wallet_entries").select("*").order("created_at", { ascending: false }),
    ]);

  const oppById = new Map((opportunities ?? []).map((o) => [o.id, o]));
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));
  const repById = new Map((reps ?? []).map((r) => [r.id, r]));

  const WALLET_TONE = {
    earned: "neutral",
    pending_client_payment: "warning",
    payable: "accent",
    approved: "accent",
    paid: "success",
    failed: "danger",
  } as const;

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PageHeader title="Finance" />

        <section className="mb-10">
          <SectionTitle>Deals &amp; collections</SectionTitle>
          <ul className="space-y-3">
            {(deals ?? []).map((d) => {
              const opp = oppById.get(d.opportunity_id);
              const client = opp ? clientById.get(opp.client_id) : undefined;
              const dealCollections = (collections ?? []).filter((c) => c.deal_id === d.id);
              return (
                <li key={d.id}>
                  <Card>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium text-foreground">
                        {opp?.prospect_name ?? "Unknown"} · {client?.name ?? "Unknown client"}
                      </p>
                      <span className="text-sm text-muted">
                        {money(Number(d.value))} · {d.status}
                      </span>
                    </div>

                    {!client?.rr_rate_basis && (
                      <form action={setClientRateBasis} className="mb-3 flex items-center gap-2 rounded-xl bg-warning-bg p-2 text-xs text-warning">
                        <input type="hidden" name="client_id" value={client?.id} />
                        <span>No RR rate configured —</span>
                        <input
                          name="rr_rate"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          placeholder="e.g. 0.10"
                          required
                          className="w-20 rounded-lg border border-warning/30 bg-surface px-1.5 py-0.5 text-foreground"
                        />
                        <button className="rounded-lg bg-warning px-2 py-0.5 font-medium text-background">Set as cash %</button>
                      </form>
                    )}

                    <ul className="space-y-1 text-sm">
                      {dealCollections.map((c) => (
                        <li key={c.id} className="flex items-center justify-between">
                          <span className="text-muted">
                            {money(Number(c.amount))} · {c.status}
                            {c.external_reference && ` · ${c.external_reference}`}
                          </span>
                          {c.status === "reported" && (
                            <form action={verifyCollection}>
                              <input type="hidden" name="collection_id" value={c.id} />
                              <input type="hidden" name="deal_id" value={d.id} />
                              <Button variant="secondary" className="!px-2 !py-0.5 text-xs">
                                Verify
                              </Button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>

                    <form action={recordCollection} className="mt-2 flex gap-2">
                      <input type="hidden" name="deal_id" value={d.id} />
                      <Input name="amount" type="number" required placeholder="Amount collected" className="flex-1 text-xs" />
                      <Input name="external_reference" placeholder="Reference (optional)" className="flex-1 text-xs" />
                      <Button className="!px-2 !py-1 text-xs shrink-0">Record</Button>
                    </form>
                  </Card>
                </li>
              );
            })}
            {(deals ?? []).length === 0 && <EmptyState title="No won deals yet." />}
          </ul>
        </section>

        <section>
          <SectionTitle>Rep wallet — Earned → Pending → Payable → Approved → Paid</SectionTitle>
          <ul className="space-y-2">
            {(wallets ?? []).map((w) => (
              <li key={w.id}>
                <Card className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-foreground">{repById.get(w.rep_id)?.full_name ?? "Unknown rep"}</span>
                    <span className="text-muted">{money(Number(w.amount))}</span>
                    <Badge tone={WALLET_TONE[w.status as keyof typeof WALLET_TONE] ?? "neutral"}>{w.status.replace(/_/g, " ")}</Badge>
                  </span>
                  <div className="flex gap-2">
                    {w.status === "pending_client_payment" && (
                      <form action={markPayablePendingToPayable}>
                        <input type="hidden" name="wallet_entry_id" value={w.id} />
                        <Button variant="secondary" className="!px-2 !py-1 text-xs">
                          RR received — mark payable
                        </Button>
                      </form>
                    )}
                    {w.status === "payable" && (
                      <form action={approvePayout}>
                        <input type="hidden" name="wallet_entry_id" value={w.id} />
                        <Button variant="secondary" className="!px-2 !py-1 text-xs">
                          Approve
                        </Button>
                      </form>
                    )}
                    {w.status === "approved" && (
                      <form action={recordPayoutPaid} className="flex gap-1">
                        <input type="hidden" name="wallet_entry_id" value={w.id} />
                        <Input name="payment_reference" placeholder="Payment reference" className="text-xs" />
                        <Button variant="secondary" className="!px-2 !py-1 text-xs">
                          Mark paid
                        </Button>
                      </form>
                    )}
                  </div>
                </Card>
              </li>
            ))}
            {(wallets ?? []).length === 0 && <EmptyState title="No rep earnings yet." />}
          </ul>
        </section>
      </div>
    </div>
  );
}
