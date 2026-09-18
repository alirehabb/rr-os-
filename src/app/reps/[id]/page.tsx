import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import {
  updateRecruitingStatus,
  assignRepToClient,
  startLiveTrial,
  reviewTrial,
  linkRepProfile,
} from "../actions";
import SetCompensationForm from "../SetCompensationForm";
import CustomEmailComposer from "./CustomEmailComposer";
import { PageHeader, SectionTitle, Card, Badge, Button, Select, Textarea, Input, EmptyState } from "@/components/ui";

const RECRUITING_STATUSES = [
  "application",
  "screening",
  "interview",
  "talent_pool",
  "rejected",
  "available_for_matching",
  "selected",
  "client_training",
  "live_trial",
  "confirmed_active",
  "bench",
  "removed",
];

export default async function RepDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: rep }, { data: assignments }, { data: clients }, { data: reconciliations }] = await Promise.all([
    supabase.from("reps").select("*").eq("id", id).single(),
    supabase.from("rep_assignments").select("*").eq("rep_id", id).order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("audit_log")
      .select("*")
      .eq("action", "reconcile_missing_commission")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!rep) notFound();
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const myReconciliations = (reconciliations ?? []).filter((r) => (r.after as { rep_id?: string } | null)?.rep_id === id);

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          title={rep.full_name}
          subtitle={`${rep.email} · ${rep.capabilities.join(", ") || "no role set"}`}
          action={
            <form action={updateRecruitingStatus} className="flex items-center gap-2">
              <input type="hidden" name="rep_id" value={rep.id} />
              <Select key={rep.recruiting_status} name="recruiting_status" defaultValue={rep.recruiting_status}>
                {RECRUITING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary">
                Update
              </Button>
            </form>
          }
        />

        <Card className="mb-8 text-sm">
          <p className="text-foreground">
            Geography: {rep.geography ?? "—"} · Timezone: {rep.timezone ?? "—"}
          </p>
          <p className="mt-1 text-muted">Claimed cash collected: {rep.claimed_cash_collected ?? "—"} (unverified claim, per §10.3)</p>
          {rep.evidence_source && <p className="mt-1 text-muted">Evidence: {rep.evidence_source}</p>}
          {rep.profile_id ? (
            <p className="mt-3 text-success">Platform login linked, can access their own workspace at /my.</p>
          ) : (
            <form action={linkRepProfile} className="mt-3">
              <input type="hidden" name="rep_id" value={rep.id} />
              <Button variant="secondary" className="text-xs">
                Link platform login (matches by email, they must sign in once first)
              </Button>
            </form>
          )}
        </Card>

        <section className="mb-8">
          <SectionTitle>Email {rep.full_name.split(" ")[0]}</SectionTitle>
          <CustomEmailComposer repId={rep.id} firstName={rep.full_name.split(" ")[0]} />
        </section>

        <section className="mb-8">
          <SectionTitle>Client assignments</SectionTitle>
          <form action={assignRepToClient} className="mb-4 flex gap-2 rounded-2xl border border-border bg-surface p-3 shadow-sm shadow-black/[0.03]">
            <input type="hidden" name="rep_id" value={rep.id} />
            <Select name="client_id" required className="flex-1">
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select name="role">
              <option value="closer">Closer</option>
              <option value="setter">Setter</option>
            </Select>
            <Button type="submit">Assign</Button>
          </form>

          <ul className="space-y-3">
            {(assignments ?? []).map((a) => (
              <li key={a.id}>
                <Card className="text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-foreground">
                      {clientNameById.get(a.client_id) ?? "Unknown client"} · {a.role}
                    </p>
                    <Badge>{a.status}</Badge>
                  </div>

                  {a.status === "training" && (
                    <form action={startLiveTrial}>
                      <input type="hidden" name="assignment_id" value={a.id} />
                      <input type="hidden" name="rep_id" value={rep.id} />
                      <Button className="!px-3 !py-1 text-xs">Start 7-day live trial</Button>
                    </form>
                  )}

                  {a.status === "trial" && (
                    <div>
                      <p className="mb-2 text-xs text-faint">
                        Trial started {a.trial_started_at ? new Date(a.trial_started_at).toLocaleString() : "—"}
                      </p>
                      <form action={reviewTrial} className="space-y-2">
                        <input type="hidden" name="assignment_id" value={a.id} />
                        <input type="hidden" name="rep_id" value={rep.id} />
                        <Textarea
                          name="trial_review_result"
                          placeholder="Human evaluation: call structure, objection handling, follow-up discipline, deals closed..."
                          rows={2}
                          className="text-xs"
                        />
                        <div className="flex gap-2">
                          <button name="outcome" value="active" className="rounded-xl bg-success-bg px-3 py-1 text-xs font-medium text-success transition-transform active:scale-[0.97]">
                            Confirm active
                          </button>
                          <button name="outcome" value="bench" className="rounded-xl bg-warning-bg px-3 py-1 text-xs font-medium text-warning transition-transform active:scale-[0.97]">
                            Bench
                          </button>
                          <button name="outcome" value="removed" className="rounded-xl bg-danger-bg px-3 py-1 text-xs font-medium text-danger transition-transform active:scale-[0.97]">
                            Remove
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {a.trial_review_result && <p className="mt-2 text-xs text-faint">Review: {a.trial_review_result}</p>}

                  {(a.status === "active" || a.status === "trial") && (
                    <div className="mt-3 border-t border-border pt-3">
                      {a.compensation_terms ? (
                        <p className="text-xs text-muted">
                          Compensation: {((a.compensation_terms as { rate: number }).rate * 100).toFixed(0)}% of{" "}
                          {(a.compensation_terms as { basis: string }).basis === "rr_share" ? "RR's share" : "client cash collected"}
                        </p>
                      ) : (
                        <SetCompensationForm assignmentId={a.id} repId={rep.id} />
                      )}
                    </div>
                  )}
                </Card>
              </li>
            ))}
            {(assignments ?? []).length === 0 && <EmptyState title="Not assigned to any client yet." />}
          </ul>
        </section>

        {myReconciliations.length > 0 && (
          <section className="mt-8">
            <SectionTitle>Commission reconciliation history</SectionTitle>
            <ul className="space-y-2 text-sm">
              {myReconciliations.map((r) => {
                const after = r.after as { amount?: number; compensation_terms?: { rate: number; basis: string } } | null;
                return (
                  <li key={r.id}>
                    <Card className="!py-2 text-xs text-muted">
                      Backfilled {after?.amount != null ? `$${Number(after.amount).toLocaleString()}` : "a"} commission on collection{" "}
                      {r.target_id?.slice(0, 8)} at {after?.compensation_terms ? `${(after.compensation_terms.rate * 100).toFixed(0)}%` : "—"} —{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
