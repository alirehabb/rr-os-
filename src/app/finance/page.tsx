import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import {
  recordCollection,
  verifyCollection,
  approvePayout,
  markPayablePendingToPayable,
  recordPayoutPaid,
  setClientRateBasis,
} from "./actions";

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
  const dealById = new Map((deals ?? []).map((d) => [d.id, d]));
  const repById = new Map((reps ?? []).map((r) => [r.id, r]));

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Finance</h1>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium">Deals & collections</h2>
          <ul className="space-y-3">
            {(deals ?? []).map((d) => {
              const opp = oppById.get(d.opportunity_id);
              const client = opp ? clientById.get(opp.client_id) : undefined;
              const dealCollections = (collections ?? []).filter((c) => c.deal_id === d.id);
              return (
                <li key={d.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">
                      {opp?.prospect_name ?? "Unknown"} · {client?.name ?? "Unknown client"}
                    </p>
                    <span className="text-sm text-neutral-400">{money(Number(d.value))} · {d.status}</span>
                  </div>

                  {!client?.rr_rate_basis && (
                    <form action={setClientRateBasis} className="mb-3 flex items-center gap-2 rounded-lg bg-amber-950 p-2 text-xs text-amber-300">
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
                        className="w-20 rounded border border-amber-800 bg-amber-900 px-1.5 py-0.5 text-amber-100"
                      />
                      <button className="rounded bg-amber-800 px-2 py-0.5">Set as cash %</button>
                    </form>
                  )}

                  <ul className="space-y-1 text-sm">
                    {dealCollections.map((c) => (
                      <li key={c.id} className="flex items-center justify-between">
                        <span>
                          {money(Number(c.amount))} · {c.status}
                          {c.external_reference && ` · ${c.external_reference}`}
                        </span>
                        {c.status === "reported" && (
                          <form action={verifyCollection}>
                            <input type="hidden" name="collection_id" value={c.id} />
                            <input type="hidden" name="deal_id" value={d.id} />
                            <button className="rounded-lg border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:bg-neutral-800">
                              Verify
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>

                  <form action={recordCollection} className="mt-2 flex gap-2">
                    <input type="hidden" name="deal_id" value={d.id} />
                    <input
                      name="amount"
                      type="number"
                      required
                      placeholder="Amount collected"
                      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
                    />
                    <input
                      name="external_reference"
                      placeholder="Reference (optional)"
                      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
                    />
                    <button className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-900">Record</button>
                  </form>
                </li>
              );
            })}
            {(deals ?? []).length === 0 && <p className="text-sm text-neutral-500">No won deals yet.</p>}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">Rep wallet — Earned → Pending → Payable → Approved → Paid</h2>
          <ul className="space-y-2">
            {(wallets ?? []).map((w) => (
              <li key={w.id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">
                <span>
                  {repById.get(w.rep_id)?.full_name ?? "Unknown rep"} · {money(Number(w.amount))} · {w.status}
                </span>
                <div className="flex gap-2">
                  {w.status === "pending_client_payment" && (
                    <form action={markPayablePendingToPayable}>
                      <input type="hidden" name="wallet_entry_id" value={w.id} />
                      <button className="rounded-lg border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800">
                        RR received — mark payable
                      </button>
                    </form>
                  )}
                  {w.status === "payable" && (
                    <form action={approvePayout}>
                      <input type="hidden" name="wallet_entry_id" value={w.id} />
                      <button className="rounded-lg border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800">
                        Approve
                      </button>
                    </form>
                  )}
                  {w.status === "approved" && (
                    <form action={recordPayoutPaid} className="flex gap-1">
                      <input type="hidden" name="wallet_entry_id" value={w.id} />
                      <input
                        name="payment_reference"
                        placeholder="Payment reference"
                        className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
                      />
                      <button className="rounded-lg border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800">
                        Mark paid
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
            {(wallets ?? []).length === 0 && <p className="text-sm text-neutral-500">No rep earnings yet.</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}
