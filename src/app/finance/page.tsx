import { createClient } from "@/lib/supabase/server";
import {
  recordCollection,
  verifyCollection,
  approvePayout,
  markPayablePendingToPayable,
  recordPayoutPaid,
  setClientRateBasis,
  createAndSendInvoice,
  voidInvoice,
} from "./actions";
import { getDemoMode } from "@/lib/demoMode";
import { PageHeader, SectionTitle, Card, Badge, Button, Input, Select, EmptyState } from "@/components/ui";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const INVOICE_TONE = {
  draft: "neutral",
  sent: "accent",
  paid: "success",
  void: "danger",
} as const;

export default async function FinancePage() {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);

  const [{ data: deals }, { data: collections }, { data: clients }, { data: opportunities }, { data: reps }, { data: wallets }, { data: invoices }] =
    await Promise.all([
      supabase.from("deals").select("*").eq("is_demo", demoMode).order("created_at", { ascending: false }),
      supabase.from("collections").select("*").eq("is_demo", demoMode).order("reported_at", { ascending: false }),
      supabase.from("clients").select("id, name, rr_rate_basis, billing_email").eq("is_demo", demoMode),
      supabase.from("opportunities").select("id, prospect_name, client_id").eq("is_demo", demoMode),
      supabase.from("reps").select("id, full_name").eq("is_demo", demoMode),
      supabase.from("wallet_entries").select("*").eq("is_demo", demoMode).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("is_demo", demoMode).order("created_at", { ascending: false }),
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
          <SectionTitle>Invoices</SectionTitle>
          <form action={createAndSendInvoice} className="mb-4 space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex gap-2">
              <Select name="client_id" required className="flex-1">
                <option value="">Client...</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select name="deal_id" className="flex-1">
                <option value="">No linked deal</option>
                {(deals ?? []).map((d) => {
                  const opp = oppById.get(d.opportunity_id);
                  const client = opp ? clientById.get(opp.client_id) : undefined;
                  return (
                    <option key={d.id} value={d.id}>
                      {client?.name ?? "Unknown"} · {opp?.prospect_name ?? d.id.slice(0, 8)}
                    </option>
                  );
                })}
              </Select>
            </div>
            <Input name="description" required placeholder="What's this invoice for?" />
            <div className="flex gap-2">
              <Input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount" className="flex-1" />
              <Input name="due_date" type="date" className="flex-1" />
              <Input name="billing_email" type="email" placeholder="Billing email (if not on file)" className="flex-1" />
            </div>
            <Button type="submit">Create &amp; send invoice</Button>
          </form>

          <ul className="space-y-2">
            {(invoices ?? []).map((inv) => {
              const client = clientById.get(inv.client_id);
              const overdue = inv.status === "sent" && inv.due_date && new Date(inv.due_date) < new Date();
              return (
                <li key={inv.id}>
                  <Card className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-foreground">
                        {client?.name ?? "Unknown client"} · {inv.description}
                      </p>
                      <p className="text-xs text-faint">
                        {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : "No due date"}
                        {inv.sent_at && ` · sent ${new Date(inv.sent_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rr-fin-num text-muted">{money(Number(inv.amount))}</span>
                      <Badge tone={overdue ? "danger" : INVOICE_TONE[inv.status as keyof typeof INVOICE_TONE] ?? "neutral"}>
                        {overdue ? "overdue" : inv.status}
                      </Badge>
                      {inv.hosted_invoice_url && (
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                          View
                        </a>
                      )}
                      {(inv.status === "draft" || inv.status === "sent") && (
                        <form action={voidInvoice}>
                          <input type="hidden" name="invoice_id" value={inv.id} />
                          <button className="text-xs text-faint hover:text-danger">Void</button>
                        </form>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
            {(invoices ?? []).length === 0 && <EmptyState title="No invoices yet." hint="Create one above to bill a client directly from RR OS." />}
          </ul>
        </section>

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
                      <span className="rr-fin-num text-sm text-muted">
                        {money(Number(d.value))} · <span className="capitalize">{d.status}</span>
                      </span>
                    </div>

                    {!client?.rr_rate_basis && (
                      <form action={setClientRateBasis} className="mb-3 flex items-center gap-2 rounded-xl bg-warning-bg p-2 text-xs text-warning">
                        <input type="hidden" name="client_id" value={client?.id} />
                        <span>No RR rate configured:</span>
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
                          <span className="rr-fin-num text-muted">
                            {money(Number(c.amount))} · <span className="capitalize">{c.status}</span>
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
          <SectionTitle>Rep wallet: Earned → Pending → Payable → Approved → Paid</SectionTitle>
          <ul className="space-y-2">
            {(wallets ?? []).map((w) => (
              <li key={w.id}>
                <Card className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-foreground">{repById.get(w.rep_id)?.full_name ?? "Unknown rep"}</span>
                    <span className="rr-fin-num text-muted">{money(Number(w.amount))}</span>
                    <Badge tone={WALLET_TONE[w.status as keyof typeof WALLET_TONE] ?? "neutral"}>{w.status.replace(/_/g, " ")}</Badge>
                  </span>
                  <div className="flex gap-2">
                    {w.status === "pending_client_payment" && (
                      <form action={markPayablePendingToPayable}>
                        <input type="hidden" name="wallet_entry_id" value={w.id} />
                        <Button variant="secondary" className="!px-2 !py-1 text-xs">
                          RR received, mark payable
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
