import { PageHeader, Card } from "@/components/ui";
import RunChasingButton from "./RunChasingButton";

export default function ChasingSettingsPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <PageHeader title="Automatic Chasing" subtitle="Runs daily via Vercel Cron. Posts to Slack and opens a Command Center item for anything newly overdue." />
      <Card className="space-y-3 text-sm text-muted">
        <p>Checks, every run:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Opportunities in follow-up past their agreed next-call date</li>
          <li>Clients with a breached 48h fulfillment deadline and unresolved handover blockers</li>
          <li>Rep live trials past their 7-day review date with no decision</li>
        </ul>
        <p className="text-xs text-faint">
          Internal notification only (founder + reps via Slack). Client-facing email chasing isn&apos;t built — clients have no
          contact email on file to send to.
        </p>
        <RunChasingButton />
      </Card>
    </div>
  );
}
