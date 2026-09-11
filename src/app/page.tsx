import { getPulseTotals, getCommandQueue, getClientClocks } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { completeActionItem, pinActionItem } from "./actions";
import Link from "next/link";
import { PageHeader, SectionTitle, StatTile, Card, EmptyState, Badge, Button } from "@/components/ui";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [pulse, queue, clocks] = await Promise.all([getPulseTotals(), getCommandQueue(), getClientClocks()]);

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <PageHeader title="RR Pulse" subtitle="Where is the money. What is happening. What needs you." />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Cash collected" value={money(pulse.cashCollected)} tone="success" />
          <StatTile label="RR outstanding receivable" value={money(pulse.rrOutstanding)} tone={pulse.rrOutstanding > 0 ? "warning" : "neutral"} />
          <StatTile label="Active pipeline" value={money(pulse.activePipelineValue)} tone="accent" />
          <StatTile label="Close rate" value={pulse.closeRate === null ? "—" : `${Math.round(pulse.closeRate * 100)}%`} />
        </section>

        <section className="mt-10">
          <SectionTitle>Command Queue</SectionTitle>
          {queue.length === 0 ? (
            <EmptyState title="Nothing open" hint="Queue items appear here as clients, opportunities, and approvals need you." />
          ) : (
            <ul className="space-y-2">
              {queue.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03] transition-colors rr-fade-up"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      {item.pinned && <span className="text-warning">★</span>}
                      {item.client_id ? (
                        <Link href={`/clients/${item.client_id}`} className="hover:underline">
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{item.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right text-sm">
                      <p className={item.money_impact === null ? "text-faint" : "font-medium text-foreground"}>
                        {item.money_impact === null ? "impact unknown" : money(item.money_impact)}
                      </p>
                      <p className="text-faint">{item.deadline_at ? new Date(item.deadline_at).toLocaleDateString() : "no deadline"}</p>
                    </div>
                    <div className="flex gap-1">
                      <form action={pinActionItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="pinned" value={String(item.pinned)} />
                        <Button variant="ghost" className="!px-2 !py-1 text-xs">
                          {item.pinned ? "Unpin" : "Pin"}
                        </Button>
                      </form>
                      <form action={completeActionItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button variant="secondary" className="!px-2 !py-1 text-xs">
                          Done
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <SectionTitle>Client fulfillment clocks</SectionTitle>
          {clocks.length === 0 ? (
            <EmptyState title="No clients yet" />
          ) : (
            <ul className="space-y-2">
              {clocks.map((c) => (
                <li key={c.client_id}>
                  <Card className="flex items-center justify-between">
                    <Link href={`/clients/${c.client_id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="flex gap-2">
                      <ClockBadge label="Fulfillment" done={!!c.fulfillment_completed_at} breached={!!c.fulfillment_breached} />
                      <ClockBadge label="Go-live" done={!!c.go_live_completed_at} breached={!!c.go_live_breached} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ClockBadge({ label, done, breached }: { label: string; done: boolean; breached: boolean }) {
  const tone = done ? "success" : breached ? "danger" : "warning";
  const text = done ? "complete" : breached ? "breached" : "in progress";
  return <Badge tone={tone}>{label}: {text}</Badge>;
}
