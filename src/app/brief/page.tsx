import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { buildFounderBrief } from "@/lib/founderBrief";
import { PageHeader, SectionTitle, StatTile, Card } from "@/components/ui";
import SendToSlackButton from "./SendToSlackButton";

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
      <div className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          title="Morning Command Brief"
          subtitle={`Generated ${new Date(brief.generatedAt).toLocaleString()}`}
          action={<SendToSlackButton />}
        />

        {nothingHappened && (
          <Card className="mb-6 bg-surface-subtle text-sm text-muted">
            Nothing happened yesterday — no calls logged, no collections, no new applications or prospects.
          </Card>
        )}

        <section className="mb-8">
          <SectionTitle>Top priorities</SectionTitle>
          {priorities.length === 0 ? (
            <p className="text-sm text-faint">Nothing urgent. Clear.</p>
          ) : (
            <ul className="space-y-2">
              {priorities.map((p, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3">
          <StatTile label="Calls logged yesterday" value={String(brief.yesterdayCallsLogged)} />
          <StatTile label="Collected yesterday" value={money(brief.yesterdayCollections)} tone="success" />
          <StatTile label="Bookings today" value={String(brief.todaysBookings)} />
          <StatTile label="Pending queue items" value={String(brief.pendingQueueItems)} />
          <StatTile label="Unpaid RR commission" value={money(brief.unpaidRRCommission)} tone={brief.unpaidRRCommission > 0 ? "warning" : "neutral"} />
          <StatTile label="Rep payouts pending" value={money(brief.pendingPayouts)} />
          <StatTile label="New talent applications" value={String(brief.newApplications)} />
          <StatTile label="New RR prospects" value={String(brief.newProspects)} />
        </section>

        {brief.approachingDeadlines.length > 0 && (
          <section className="mb-8">
            <SectionTitle>
              <span className="text-warning">Approaching deadlines (24h)</span>
            </SectionTitle>
            <ul className="space-y-1 text-sm">
              {brief.approachingDeadlines.map((d, i) => (
                <li key={i} className="text-muted">
                  <Link href={`/clients/${d.clientId}`} className="text-foreground hover:underline">
                    {d.clientName}
                  </Link>{" "}
                  — {d.kind.replace("_", "-")} due {new Date(d.deadline).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-faint">
          This brief reflects real records only. Deeper pattern detection and automatic distraction intervention are later-scope (§6.2).
        </p>
      </div>
    </div>
  );
}
