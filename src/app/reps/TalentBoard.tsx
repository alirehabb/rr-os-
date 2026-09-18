"use client";

import { useEffect, useState } from "react";
import { MapPin, Mail, Phone, Globe, Link2, FileText, Video, PlayCircle } from "lucide-react";
import { Badge, Button, Select, Avatar, Textarea, EmptyState } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { updateRecruitingStatus, linkRepProfile, assignRepToClient, startLiveTrial, reviewTrial, getRepFullRecord } from "./actions";
import SetCompensationForm from "./SetCompensationForm";
import CustomEmailComposer from "./[id]/CustomEmailComposer";

type Rep = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  recruiting_status: string;
  capabilities: string[];
  geography: string | null;
  timezone: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  intro_loom_url: string | null;
  sales_recording_url: string | null;
  offer_text: string | null;
  evidence_source: string | null;
  claimed_cash_collected: number | null;
  notes: string | null;
  community_waitlist: boolean;
  profile_id: string | null;
  is_demo: boolean;
};

type Assignment = {
  id: string;
  client_id: string;
  role: string;
  status: string;
  trial_started_at: string | null;
  trial_review_result: string | null;
  compensation_terms: unknown;
};
type Reconciliation = { id: string; target_id: string | null; created_at: string; after: unknown };
type FullRecord = { assignments: Assignment[]; clients: { id: string; name: string }[]; reconciliations: Reconciliation[] };

const STATUS_TONE = {
  application: "neutral",
  screening: "neutral",
  interview: "accent",
  talent_pool: "neutral",
  rejected: "danger",
  available_for_matching: "accent",
  selected: "accent",
  client_training: "warning",
  live_trial: "warning",
  confirmed_active: "success",
  bench: "warning",
  removed: "danger",
} as const;

const RECRUITING_STATUSES = Object.keys(STATUS_TONE) as (keyof typeof STATUS_TONE)[];

// Recruiting flow, grouped into a real scouting board: Applicants -> Review
// -> Talent Pool -> Matched -> Trial -> Active, with Bench/Removed off to
// the side. Every stage is split Closer/Setter — this is roster management,
// not a single flat applicant table.
const GROUPS: { label: string; statuses: (keyof typeof STATUS_TONE)[] }[] = [
  { label: "Applicants", statuses: ["application"] },
  { label: "Review", statuses: ["screening", "interview"] },
  { label: "Talent Pool", statuses: ["talent_pool", "available_for_matching", "selected"] },
  { label: "Matched", statuses: ["client_training"] },
  { label: "Trial", statuses: ["live_trial"] },
  { label: "Active", statuses: ["confirmed_active"] },
  { label: "Bench", statuses: ["bench"] },
  { label: "Removed", statuses: ["removed", "rejected"] },
];

const ROLE_COLUMNS: { label: string; capability: string }[] = [
  { label: "Closers", capability: "closer" },
  { label: "Setters", capability: "setter" },
];

function tone(status: string) {
  return STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral";
}

export default function TalentBoard({
  reps,
  activeAccountCountByRep,
}: {
  reps: Rep[];
  activeAccountCountByRep: Record<string, number>;
}) {
  const [selected, setSelected] = useState<Rep | null>(null);

  return (
    <div className="space-y-10">
      {GROUPS.map((group) => {
        const groupReps = reps.filter((r) => group.statuses.includes(r.recruiting_status as keyof typeof STATUS_TONE));
        if (groupReps.length === 0) return null;
        return (
          <section key={group.label}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
              <Badge tone="neutral">{groupReps.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {ROLE_COLUMNS.map((col) => {
                const colReps = groupReps.filter((r) => r.capabilities.includes(col.capability));
                if (colReps.length === 0) return null;
                return (
                  <div key={col.label}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                      {col.label} <span className="text-faint">({colReps.length})</span>
                    </p>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {colReps.map((r) => (
                        <li key={r.id}>
                          <button
                            onClick={() => setSelected(r)}
                            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-center shadow-sm shadow-black/[0.03] transition-transform hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                          >
                            <Avatar name={r.full_name} />
                            <p className="font-medium text-foreground">{r.full_name}</p>
                            {r.geography && (
                              <p className="flex items-center gap-1 text-xs text-muted">
                                <MapPin size={11} /> {r.geography}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {r.is_demo && <Badge tone="accent">Demo</Badge>}
                              <Badge tone={tone(r.recruiting_status)}>{r.recruiting_status.replace(/_/g, " ")}</Badge>
                            </div>
                            {(activeAccountCountByRep[r.id] ?? 0) > 0 && (
                              <p className="text-[11px] text-faint">{activeAccountCountByRep[r.id]} active account(s)</p>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {reps.length === 0 && <p className="text-sm text-faint">No applicants yet.</p>}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.full_name ?? ""}>
        {selected && <RepProfile rep={selected} onStatusChanged={(status) => setSelected({ ...selected, recruiting_status: status })} />}
      </Sheet>
    </div>
  );
}

function RepProfile({ rep, onStatusChanged }: { rep: Rep; onStatusChanged: (status: string) => void }) {
  const [record, setRecord] = useState<FullRecord | null>(null);
  const firstName = rep.full_name.split(" ")[0];

  useEffect(() => {
    setRecord(null);
    getRepFullRecord(rep.id).then(setRecord);
  }, [rep.id]);

  return (
    <div className="space-y-6 text-sm">
      {/* Identity header */}
      <div className="flex items-center gap-3">
        <Avatar name={rep.full_name} size="md" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{rep.full_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {rep.capabilities.map((c) => (
              <Badge key={c} tone="neutral">
                {c}
              </Badge>
            ))}
            {rep.community_waitlist && <Badge tone="accent">Community waitlist</Badge>}
          </div>
        </div>
      </div>

      {/* Status changer */}
      <div className="rounded-2xl border border-border bg-surface-subtle/40 p-4">
        <form
          action={async (fd) => {
            const next = String(fd.get("recruiting_status"));
            await updateRecruitingStatus(fd);
            onStatusChanged(next);
          }}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="rep_id" value={rep.id} />
          <Select key={rep.recruiting_status} name="recruiting_status" defaultValue={rep.recruiting_status} className="flex-1">
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
        <p className="mt-2 text-xs text-faint">Changing status emails {firstName} automatically with the matching template.</p>
      </div>

      {/* Contact + quick facts, Apple-style stat grid */}
      <div className="grid grid-cols-2 gap-2">
        <Fact icon={Mail} label="Email" value={rep.email} href={`mailto:${rep.email}`} />
        <Fact icon={Phone} label="Phone" value={rep.phone} href={rep.phone ? `tel:${rep.phone}` : undefined} />
        <Fact icon={MapPin} label="Location" value={rep.geography} />
        <Fact icon={Globe} label="Timezone" value={rep.timezone} />
      </div>

      {(rep.linkedin_url || rep.resume_url || rep.intro_loom_url || rep.sales_recording_url) && (
        <div className="flex flex-wrap gap-2">
          <LinkPill icon={Link2} label="LinkedIn" href={rep.linkedin_url} />
          <LinkPill icon={FileText} label="Resume" href={rep.resume_url} />
          <LinkPill icon={Video} label="Intro Loom" href={rep.intro_loom_url} />
          <LinkPill icon={PlayCircle} label="Sales recording" href={rep.sales_recording_url} />
        </div>
      )}

      {(rep.offer_text || rep.evidence_source || rep.claimed_cash_collected || rep.notes) && (
        <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
          {rep.offer_text && <p className="text-foreground">{rep.offer_text}</p>}
          {rep.evidence_source && <p className="text-xs text-muted">Evidence: {rep.evidence_source}</p>}
          {rep.claimed_cash_collected != null && (
            <p className="text-xs text-muted">Claimed cash collected: ${Number(rep.claimed_cash_collected).toLocaleString()} (unverified claim)</p>
          )}
          {rep.notes && <p className="whitespace-pre-wrap text-xs text-muted">{rep.notes}</p>}
        </div>
      )}

      {rep.profile_id ? (
        <p className="text-xs text-success">Platform login linked, can access their own workspace at /my.</p>
      ) : (
        <form action={linkRepProfile}>
          <input type="hidden" name="rep_id" value={rep.id} />
          <Button type="submit" variant="secondary" className="text-xs">
            Link platform login
          </Button>
        </form>
      )}

      {/* Email composer, inline */}
      <Section title={`Email ${firstName}`}>
        <CustomEmailComposer repId={rep.id} firstName={firstName} />
      </Section>

      {/* Client assignments, trial, compensation */}
      {record ? (
        <Section title="Client assignments">
          <form action={assignRepToClient} className="mb-3 flex gap-2 rounded-2xl border border-border bg-surface p-3">
            <input type="hidden" name="rep_id" value={rep.id} />
            <Select name="client_id" required className="flex-1 !py-1.5 text-xs">
              {record.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select name="role" className="!py-1.5 text-xs">
              <option value="closer">Closer</option>
              <option value="setter">Setter</option>
            </Select>
            <Button type="submit" className="!px-3 !py-1.5 text-xs">
              Assign
            </Button>
          </form>

          <div className="space-y-2.5">
            {record.assignments.map((a) => {
              const clientName = record.clients.find((c) => c.id === a.client_id)?.name ?? "Unknown client";
              return (
                <div key={a.id} className="rounded-2xl border border-border bg-surface p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="font-medium text-foreground">
                      {clientName} · {a.role}
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
                </div>
              );
            })}
            {record.assignments.length === 0 && <EmptyState title="Not assigned to any client yet." />}
          </div>
        </Section>
      ) : (
        <p className="text-xs text-faint">Loading assignments...</p>
      )}

      {record && record.reconciliations.length > 0 && (
        <Section title="Commission reconciliation history">
          <div className="space-y-1.5">
            {record.reconciliations.map((r) => {
              const after = r.after as { amount?: number; compensation_terms?: { rate: number; basis: string } } | null;
              return (
                <div key={r.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
                  Backfilled {after?.amount != null ? `$${Number(after.amount).toLocaleString()}` : "a"} commission on collection{" "}
                  {r.target_id?.slice(0, 8)} at {after?.compensation_terms ? `${(after.compensation_terms.rate * 100).toFixed(0)}%` : "—"} —{" "}
                  {new Date(r.created_at).toLocaleString()}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">{title}</p>
      {children}
    </div>
  );
}

function Fact({ icon: Icon, label, value, href }: { icon: typeof Mail; label: string; value: string | null; href?: string }) {
  if (!value) return null;
  const content = (
    <div className="rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-accent/40">
      <p className="flex items-center gap-1 text-[11px] text-faint">
        <Icon size={11} /> {label}
      </p>
      <p className="mt-0.5 truncate text-sm text-foreground">{value}</p>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    content
  );
}

function LinkPill({ icon: Icon, label, href }: { icon: typeof Mail; label: string; href: string | null }) {
  if (!href || !/^https?:\/\//.test(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-surface-subtle"
    >
      <Icon size={12} className="text-accent" /> {label}
    </a>
  );
}
