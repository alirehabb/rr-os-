import { getPulseTotals, getCommandQueue, getClientClocks } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { completeActionItem, pinActionItem } from "./actions";
import Link from "next/link";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [pulse, queue, clocks] = await Promise.all([
    getPulseTotals(),
    getCommandQueue(),
    getClientClocks(),
  ]);

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">RR Pulse</h1>
        <p className="text-sm text-neutral-400">Where is the money. What is happening. What needs you.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <PulseCard label="Cash collected (verified)" value={money(pulse.cashCollected)} />
        <PulseCard label="RR outstanding receivable" value={money(pulse.rrOutstanding)} />
        <PulseCard label="Active pipeline (booked value)" value={money(pulse.activePipelineValue)} />
        <PulseCard
          label="Close rate"
          value={pulse.closeRate === null ? "No attended calls yet" : `${Math.round(pulse.closeRate * 100)}%`}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-medium">Command Queue</h2>
        {queue.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
            Nothing open. Queue items appear here as clients, opportunities, and approvals need you.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div>
                  <p className="font-medium text-neutral-100">
                    {item.pinned && <span className="mr-1 text-amber-400">📌</span>}
                    {item.client_id ? (
                      <Link href={`/clients/${item.client_id}`} className="hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </p>
                  <p className="text-sm text-neutral-400">{item.reason}</p>
                </div>
                <div className="flex items-center gap-3 text-right text-sm">
                  <div>
                    <p className="text-neutral-300">
                      {item.money_impact === null ? "impact: unknown" : money(item.money_impact)}
                    </p>
                    <p className="text-neutral-500">
                      {item.deadline_at ? new Date(item.deadline_at).toLocaleDateString() : "no deadline"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <form action={pinActionItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="pinned" value={String(item.pinned)} />
                      <button className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">
                        {item.pinned ? "Unpin" : "Pin"}
                      </button>
                    </form>
                    <form action={completeActionItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">
                        Done
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-medium">Client fulfillment clocks</h2>
        {clocks.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
            No clients yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {clocks.map((c) => (
              <li
                key={c.client_id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <p className="font-medium">{c.name}</p>
                <div className="flex gap-4 text-sm">
                  <ClockBadge
                    label="Fulfillment"
                    done={!!c.fulfillment_completed_at}
                    breached={!!c.fulfillment_breached}
                  />
                  <ClockBadge
                    label="Go-live"
                    done={!!c.go_live_completed_at}
                    breached={!!c.go_live_breached}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

function PulseCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ClockBadge({ label, done, breached }: { label: string; done: boolean; breached: boolean }) {
  const color = done ? "text-emerald-400" : breached ? "text-red-400" : "text-amber-400";
  const text = done ? "complete" : breached ? "breached" : "in progress";
  return (
    <span className={color}>
      {label}: {text}
    </span>
  );
}
