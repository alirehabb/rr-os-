import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, StatTile, Badge, Button, EmptyState } from "@/components/ui";
import { displayCompanyName } from "@/lib/format";
import { clearHumanReview } from "./actions";

type LogRow = { id: string; created_at: string; target_id: string | null; after: Record<string, unknown> | null };

function statusOf(row: LogRow): string {
  return String(row.after?.status ?? "unknown");
}
function reasonOf(row: LogRow): string {
  return String(row.after?.reason ?? "");
}

// Only outcomes that actually mean something to a founder reading this
// page. Everything else here is the agent's own internal gating (a reply
// that wasn't from someone interested, a lead who spoke last, a prospect
// it already touched today) — real, correct behavior, but noise on a
// summary page. Filtered here rather than not logged at all, so the full
// trail still exists in audit_log for debugging.
const REPLY_NOISE_REASONS = ["classified_NOT_INTERESTED", "classified_no_response"];
const FOLLOWUP_MEANINGFUL_STATUSES = new Set(["sent", "failed", "no_draft", "escalated"]);

function labelFor(status: string, reason: string): string {
  if (status === "escalated" || reason === "escalated_to_human") return "Escalated to you";
  if (reason === "prospect_rejected") return "Marked lost";
  if (status === "sent") return "Sent";
  if (status === "failed") return "Send failed";
  if (status === "no_draft") return "Couldn't draft";
  return status.replace(/_/g, " ");
}

// Apple-style activity summary for the AI agent, replacing the old
// drag-and-drop follow-up inbox entirely: a stat bar (same shape as the CRM
// pipeline bar) plus a short breakdown per action type, not a wall of rows.
export default async function AgentActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "founder" || r.role === "internal")) redirect("/");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: replyLog }, { data: followUpLog }, { data: needsReview }, { data: pipeline }] = await Promise.all([
    supabase.from("audit_log").select("id, created_at, target_id, after").eq("action", "ai_agent_auto_reply").gte("created_at", since).order("created_at", { ascending: false }),
    supabase.from("audit_log").select("id, created_at, target_id, after").eq("action", "ai_agent_follow_up").gte("created_at", since).order("created_at", { ascending: false }),
    supabase
      .from("prospects")
      .select("id, contact_name, company_name, contact_email, human_review_reason, updated_at")
      .eq("needs_human_review", true)
      .order("updated_at", { ascending: false }),
    supabase.from("prospects").select("stage", { count: "exact", head: false }).in("stage", ["call_booked", "lost"]),
  ]);

  const allReplies = (replyLog ?? []) as LogRow[];
  const allFollowUps = (followUpLog ?? []) as LogRow[];

  // Reply log doesn't carry a "classification" field directly — it's baked
  // into the reason string on skipped rows. Interested-only means: it was
  // sent (or tried to send/draft), or escalated. Never a bare classification skip.
  const replies = allReplies.filter((r) => statusOf(r) !== "skipped" || reasonOf(r) === "escalated_to_human" || reasonOf(r) === "needs_human_review");
  const followUps = allFollowUps.filter((r) => FOLLOWUP_MEANINGFUL_STATUSES.has(statusOf(r)) || reasonOf(r) === "prospect_rejected");

  const targetIds = Array.from(new Set([...replies, ...followUps].map((r) => r.target_id).filter(Boolean))) as string[];
  const { data: relatedProspects } = targetIds.length
    ? await supabase.from("prospects").select("id, contact_name, company_name").in("id", targetIds)
    : { data: [] };
  const prospectById = new Map((relatedProspects ?? []).map((p) => [p.id, p]));

  const repliesSent = allReplies.filter((r) => statusOf(r) === "sent").length;
  const followUpsSent = allFollowUps.filter((r) => statusOf(r) === "sent").length;
  const rejected = allFollowUps.filter((r) => reasonOf(r) === "prospect_rejected").length;
  const bookedCount = (pipeline ?? []).filter((p) => p.stage === "call_booked").length;
  const lostCount = (pipeline ?? []).filter((p) => p.stage === "lost").length;

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="AI Agent"
          subtitle="Replies within ~10-30 min of an interested lead responding. Follow-ups once a day, mornings in their timezone, only while interested and not yet booked. Last 7 days below."
        />

        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Replies Sent" value={String(repliesSent)} tone="accent" />
          <StatTile label="Follow-Ups Sent" value={String(followUpsSent)} tone="accent" />
          <StatTile label="Needs You" value={String((needsReview ?? []).length)} tone={(needsReview ?? []).length ? "warning" : "neutral"} />
          <StatTile label="Meetings Booked" value={String(bookedCount)} tone="success" />
          <StatTile label="Declined" value={String(rejected)} tone="danger" />
          <StatTile label="Lost" value={String(lostCount)} tone="danger" />
        </div>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">Needs You</h2>
          {(needsReview ?? []).length === 0 ? (
            <EmptyState title="Nothing waiting on you." hint="The agent flags a thread here when a prospect suggests specific times or gives a vague answer, instead of replying on its own." />
          ) : (
            <div className="space-y-2">
              {(needsReview ?? []).map((p) => (
                <Card key={p.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/prospects/${p.id}`} className="truncate text-sm font-medium text-foreground hover:underline">
                      {p.contact_name || displayCompanyName(p.company_name)}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {p.contact_email} · {p.human_review_reason ?? "Needs a human reply"}
                    </p>
                  </div>
                  <form action={clearHumanReview.bind(null, p.id)}>
                    <Button variant="secondary" className="shrink-0 text-xs">
                      Mark Handled
                    </Button>
                  </form>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <ActivitySection title="Recent Replies" hint="Only leads Instantly flagged as interested." rows={replies.slice(0, 12)} prospectById={prospectById} />
          <ActivitySection title="Recent Follow-Ups" hint="Sent, escalated, or marked lost — routine waiting is hidden." rows={followUps.slice(0, 12)} prospectById={prospectById} />
        </div>
      </div>
    </div>
  );
}

function ActivitySection({
  title,
  hint,
  rows,
  prospectById,
}: {
  title: string;
  hint: string;
  rows: LogRow[];
  prospectById: Map<string, { id: string; contact_name: string | null; company_name: string }>;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h2>
      <p className="mb-3 text-xs text-faint">{hint}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-faint">Nothing yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const status = statusOf(r);
            const reason = reasonOf(r);
            const label = labelFor(status, reason);
            const tone = status === "sent" ? "success" : status === "escalated" || reason === "escalated_to_human" ? "warning" : status === "failed" ? "danger" : reason === "prospect_rejected" ? "danger" : "neutral";
            const prospect = r.target_id ? prospectById.get(r.target_id) : undefined;
            const name = prospect ? prospect.contact_name || displayCompanyName(prospect.company_name) : String(r.after?.lead ?? "Prospect");
            return (
              <Card key={r.id} className="flex items-center justify-between gap-3 !py-2.5 text-sm">
                {r.target_id ? (
                  <Link href={`/prospects/${r.target_id}`} className="truncate text-foreground hover:underline">
                    {name}
                  </Link>
                ) : (
                  <span className="truncate text-muted">{name}</span>
                )}
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={tone}>{label}</Badge>
                  <span className="text-[11px] text-faint">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
