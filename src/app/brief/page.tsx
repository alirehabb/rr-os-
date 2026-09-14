import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { buildFounderBrief } from "@/lib/founderBrief";
import { getDemoMode } from "@/lib/demoMode";
import { askAI } from "@/lib/ai";
import { PageHeader, SectionTitle, StatTile, Card } from "@/components/ui";
import { Sparkles } from "lucide-react";
import SendToSlackButton from "./SendToSlackButton";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function BriefPage() {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const brief = await buildFounderBrief(supabase, demoMode);

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

  // AI narrative sits on top of the real numbers above, never in place of
  // them — it's told to use only the facts given, and the page works fine
  // (just without this section) if the key is missing or the call fails.
  const aiTake = nothingHappened
    ? null
    : await askAI(
        `You're a terse ops assistant writing one short paragraph (2-3 sentences, no bullet points, no markdown) telling a founder what to focus on today. Use ONLY these facts, don't invent anything else:
Top priorities: ${priorities.length ? priorities.join("; ") : "none"}
Calls logged yesterday: ${brief.yesterdayCallsLogged}
Collected yesterday: $${brief.yesterdayCollections}
Bookings today: ${brief.todaysBookings}
Unpaid RR commission: $${brief.unpaidRRCommission}
Rep payouts pending: $${brief.pendingPayouts}
New talent applications: ${brief.newApplications}
New RR prospects: ${brief.newProspects}`,
        { system: "Plain English, short paragraphs, no em dashes, no corporate filler, sound like a sharp colleague not a report.", maxTokens: 300 },
      );

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
            Nothing happened yesterday. No calls logged, no collections, no new applications or prospects.
          </Card>
        )}

        {aiTake && (
          <Card className="mb-8 border-accent/20 bg-accent/5 text-sm text-foreground">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-accent">
              <Sparkles size={12} /> AI take
            </div>
            {aiTake}
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
                  {d.kind.replace("_", "-")} due {new Date(d.deadline).toLocaleString()}
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
