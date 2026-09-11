import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { buildFounderBrief } from "@/lib/founderBrief";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function BriefPage() {
  const supabase = await createClient();
  const brief = await buildFounderBrief(supabase);

  const nothingHappened =
    brief.yesterdayCallsLogged === 0 &&
    brief.yesterdayCollections === 0 &&
    brief.newApplications === 0 &&
    brief.newProspects === 0;

  const priorities = [
    ...brief.breachedDeadlines.map((d) => `${d.clientName}: ${d.kind.replace("_", "-")} deadline breached`),
    ...brief.overdueFollowUps.map((o) => `Overdue follow-up: ${o.prospectName}`),
    ...brief.onboardingBlockers.map((b) => `${b.clientName}: ${b.blockerCount} handover blocker(s)`),
    ...brief.neglectedOpportunities.map((o) => `Neglected: ${o.prospectName} (${o.daysSinceActivity}d no activity)`),
  ].slice(0, 5);

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold">Morning Command Brief</h1>
        <p className="mb-6 text-sm text-neutral-500">Generated {new Date(brief.generatedAt).toLocaleString()}</p>

        {nothingHappened && (
          <p className="mb-6 rounded-lg bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
            Nothing happened yesterday — no calls logged, no collections, no new applications or prospects.
          </p>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Top priorities</h2>
          {priorities.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing urgent. Clear.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-neutral-200">
              {priorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8 grid grid-cols-2 gap-4 text-sm">
          <Stat label="Calls logged yesterday" value={String(brief.yesterdayCallsLogged)} />
          <Stat label="Collected yesterday" value={money(brief.yesterdayCollections)} />
          <Stat label="Bookings today" value={String(brief.todaysBookings)} />
          <Stat label="Pending queue items" value={String(brief.pendingQueueItems)} />
          <Stat label="Unpaid RR commission" value={money(brief.unpaidRRCommission)} />
          <Stat label="Rep payouts pending approval/payment" value={money(brief.pendingPayouts)} />
          <Stat label="New talent applications" value={String(brief.newApplications)} />
          <Stat label="New RR prospects" value={String(brief.newProspects)} />
        </section>

        {brief.approachingDeadlines.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-medium text-amber-400">Approaching deadlines (24h)</h2>
            <ul className="space-y-1 text-sm">
              {brief.approachingDeadlines.map((d, i) => (
                <li key={i}>
                  <Link href={`/clients/${d.clientId}`} className="hover:underline">
                    {d.clientName}
                  </Link>{" "}
                  — {d.kind.replace("_", "-")} due {new Date(d.deadline).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-neutral-600">
          This brief reflects real records only. Deeper pattern detection and automatic distraction intervention are later-scope (§6.2).
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
