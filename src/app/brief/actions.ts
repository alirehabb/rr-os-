"use server";

import { createClient } from "@/lib/supabase/server";
import { buildFounderBrief } from "@/lib/founderBrief";
import { getDemoMode } from "@/lib/demoMode";
import { slackPostMessage } from "@/lib/slack";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// Posts the same real numbers the /brief page shows — never a separate
// "Slack version" of the truth.
export async function sendBriefToSlack() {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const brief = await buildFounderBrief(supabase, demoMode);

  const priorities = [
    ...brief.breachedDeadlines.map((d) => `• ${d.clientName}: ${d.kind.replace("_", "-")} deadline breached`),
    ...brief.overdueFollowUps.map((o) => `• Overdue follow-up: ${o.prospectName}`),
    ...brief.onboardingBlockers.map((b) => `• ${b.clientName}: ${b.blockerCount} handover blocker(s)`),
    ...brief.neglectedOpportunities.map((o) => `• Neglected: ${o.prospectName} (${o.daysSinceActivity}d no activity)`),
  ].slice(0, 5);

  const lines = [
    `*Morning Command Brief* — ${new Date(brief.generatedAt).toLocaleDateString()}`,
    "",
    priorities.length ? priorities.join("\n") : "Nothing urgent. Clear.",
    "",
    `Calls logged yesterday: ${brief.yesterdayCallsLogged}`,
    `Collected yesterday: ${money(brief.yesterdayCollections)}`,
    `Bookings today: ${brief.todaysBookings}`,
    `Pending queue items: ${brief.pendingQueueItems}`,
    `Unpaid RR commission: ${money(brief.unpaidRRCommission)}`,
  ];

  try {
    await slackPostMessage(lines.join("\n"));
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
