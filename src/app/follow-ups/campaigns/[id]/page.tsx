import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import { displayCompanyName } from "@/lib/format";
import { DEDUPE_WINDOW_MS, LOCAL_HOUR_WINDOW, isWithinLocalMorning } from "@/lib/followupEngine";
import RunCampaignButton from "./RunCampaignButton";

function nextEligibleLabel(lastFollowupAt: string | null, timezone: string | null): string {
  if (lastFollowupAt) {
    const readyAt = new Date(lastFollowupAt).getTime() + DEDUPE_WINDOW_MS;
    if (readyAt > Date.now()) return `Not before ${new Date(readyAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  }
  if (!isWithinLocalMorning(timezone)) {
    return timezone ? `Waiting for ${timezone} morning (${LOCAL_HOUR_WINDOW[0]}am-${LOCAL_HOUR_WINDOW[1]}pm)` : "Waiting for next window";
  }
  return "Eligible on next run";
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: myRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "founder" || r.role === "internal")) redirect("/");

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) notFound();

  const { data: members } = await supabase
    .from("campaign_prospects")
    .select("id, added_at, prospects(id, company_name, contact_name, contact_email, stage, source, timezone, last_ai_followup_at)")
    .eq("campaign_id", id)
    .order("added_at", { ascending: false });

  const prospectIds = (members ?? []).map((m) => m.prospects?.id).filter(Boolean) as string[];
  const { data: recentActivity } = prospectIds.length
    ? await supabase
        .from("audit_log")
        .select("target_id, created_at, after")
        .eq("action", "ai_agent_follow_up")
        .in("target_id", prospectIds)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [] };

  // Latest row per prospect — audit_log has no "distinct on" via the JS
  // client, so this reduces the ordered result set down client-side.
  const latestByProspect = new Map<string, { created_at: string; after: Record<string, unknown> }>();
  for (const row of recentActivity ?? []) {
    if (row.target_id && !latestByProspect.has(row.target_id)) {
      latestByProspect.set(row.target_id, row as { created_at: string; after: Record<string, unknown> });
    }
  }

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/follow-ups" className="mb-4 flex items-center gap-1 text-sm text-faint hover:text-foreground">
          <ArrowLeft size={14} /> Back to Follow-Ups
        </Link>
        <PageHeader
          title={campaign.name}
          subtitle={campaign.channel === "instantly" ? "Instantly channel — replies land back in-thread and auto-send." : "Sarah channel — every follow-up is drafted for review, never auto-sent."}
          action={<RunCampaignButton campaignId={campaign.id} disabled={(members ?? []).length === 0} />}
        />

        {campaign.channel === "sarah" && (
          <div className="mb-6 rounded-2xl border border-warning/30 bg-warning-bg/40 px-4 py-3 text-sm text-warning">
            Heads up: if someone replies to a Sarah-sent follow-up, it lands in Sarah&apos;s real inbox, not Instantly. The AI reply agent only watches Instantly threads, so a reply here won&apos;t trigger it automatically, you&apos;d need to check Sarah&apos;s inbox directly.
          </div>
        )}
        {campaign.channel === "instantly" && (
          <div className="mb-6 rounded-2xl border border-success/30 bg-success-bg/40 px-4 py-3 text-sm text-success">
            This is in sync with the AI reply agent automatically. If someone replies to a follow-up sent here, it&apos;s just another Instantly reply, the reactive reply agent picks it up on its own next run.
          </div>
        )}

        {(members ?? []).length === 0 ? (
          <EmptyState title="No prospects in this campaign yet." hint="Drag prospects onto this campaign from the Follow-Ups inbox." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1.2fr] gap-0 border-b border-border bg-surface-subtle/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-faint">
              <p>Contact</p>
              <p>Last activity</p>
              <p>Status</p>
              <p>Scheduled</p>
            </div>
            <ul>
              {(members ?? []).map((m) => {
                const p = m.prospects;
                if (!p) return null;
                const activity = latestByProspect.get(p.id);
                const status = activity?.after?.status as string | undefined;
                const reason = activity?.after?.reason as string | undefined;
                const draft = activity?.after?.draft as string | undefined;
                return (
                  <li key={m.id} className="border-b border-border last:border-0 hover:bg-surface-subtle/40">
                    <div className="grid grid-cols-[1.3fr_1fr_1fr_1.2fr] items-center gap-0 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <Link href={`/follow-ups`} className="truncate font-medium text-foreground hover:underline">
                          {p.contact_name || displayCompanyName(p.company_name)}
                        </Link>
                        <p className="truncate text-xs text-faint">{displayCompanyName(p.company_name)}</p>
                      </div>
                      <p className="text-xs text-faint">{activity ? new Date(activity.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never run"}</p>
                      <div>
                        {!status ? (
                          <Badge tone="neutral">Not yet run</Badge>
                        ) : status === "sent" ? (
                          <Badge tone="success">Sent</Badge>
                        ) : status === "drafted_for_review" ? (
                          <Badge tone="accent">Drafted, awaiting review</Badge>
                        ) : status === "failed" ? (
                          <Badge tone="danger">Failed to send</Badge>
                        ) : (
                          <Badge tone="warning">{(reason ?? status).replace(/_/g, " ")}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-faint">{nextEligibleLabel(p.last_ai_followup_at, p.timezone)}</p>
                    </div>
                    {draft && (
                      <details className="border-t border-border px-4 py-2">
                        <summary className="cursor-pointer text-xs text-accent">View follow-up text</summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-subtle/60 p-3 text-xs text-muted">{draft}</p>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
