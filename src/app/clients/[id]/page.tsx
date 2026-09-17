import { createClient } from "@/lib/supabase/server";
import NotesThread from "@/components/NotesThread";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  updateHandoverItemStatus,
  updateLifecycleState,
  markFulfillmentComplete,
  markGoLiveComplete,
  setClientStageLabel,
  removeClientStageLabel,
} from "../actions";
import { PageHeader, SectionTitle, Card, Badge, Button, Select, Input, EmptyState } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { buildClientTimeline } from "@/lib/clientTimeline";

function money(n: number) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const INVOICE_TONE = { draft: "neutral", sent: "accent", paid: "success", void: "danger" } as const;

const UNIVERSAL_STAGES = ["upstream", "booked", "follow_up", "won", "lost"] as const;
const STAGE_HINT: Record<string, string> = {
  upstream: "Before a call is booked",
  booked: "Call booked, not yet happened",
  follow_up: "Call happened, still open",
  won: "Closed won",
  lost: "Closed lost",
};

const LIFECYCLE_STATES = [
  "onboarding",
  "access_pending",
  "fulfillment",
  "rep_training_trial",
  "live",
  "active",
  "paused",
  "churned",
];

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: clock }, { data: handover }, { data: opportunities }, { data: assignments }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("client_clocks").select("*").eq("client_id", id).single(),
    supabase.from("handover_items").select("*").eq("client_id", id).order("category"),
    supabase
      .from("opportunities")
      .select("id, prospect_name, stage, custom_stage_label, value, first_booked_at")
      .eq("client_id", id)
      .order("first_booked_at", { ascending: false }),
    supabase.from("rep_assignments").select("id, rep_id, role, status").eq("client_id", id),
  ]);

  if (!client) notFound();

  const [timeline, { data: invoices }, { data: libraryItems }, { data: agreementDocs }, { data: stageLabels }] = await Promise.all([
    buildClientTimeline(supabase, id),
    supabase.from("invoices").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("knowledge_items").select("id, title, type").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("documents").select("id, title, doc_type, status").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("client_stage_labels").select("*").eq("client_id", id),
  ]);
  const stageLabelByStage = new Map((stageLabels ?? []).map((s) => [s.stage, s]));

  const cashCollected = (invoices ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  const repIds = (assignments ?? []).map((a) => a.rep_id);
  const { data: assignedReps } = repIds.length ? await supabase.from("reps").select("id, full_name").in("id", repIds) : { data: [] };
  const repNameByIdForAssignments = new Map((assignedReps ?? []).map((r) => [r.id, r.full_name]));
  const hasActiveRep = (assignments ?? []).some((a) => a.status === "active");

  const blockers = (handover ?? []).filter((h) => h.blocks_readiness && h.status !== "verified" && h.status !== "not_applicable");

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title={client.name}
          subtitle={
            <>
              {client.workflow_type.replace("_", " ")} ·{" "}
              <Link href={`/clients/${client.id}/report`} className="underline hover:text-foreground">
                Reports
              </Link>
            </>
          }
          action={
            <form action={updateLifecycleState} className="flex items-center gap-2">
              <input type="hidden" name="client_id" value={client.id} />
              <Select key={client.lifecycle_state} name="lifecycle_state" defaultValue={client.lifecycle_state}>
                {LIFECYCLE_STATES.map((s) => (
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

        <Tabs
          tabs={[
            {
              key: "overview",
              label: "Overview",
              content: (
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card>
                    <p className="text-xs font-medium uppercase tracking-wide text-faint">Fulfillment · signed + 48h</p>
                    {client.fulfillment_completed_at ? (
                      <p className="mt-1.5 text-success">Complete {new Date(client.fulfillment_completed_at).toLocaleString()}</p>
                    ) : (
                      <>
                        <p className={`mt-1.5 ${clock?.fulfillment_breached ? "text-danger" : "text-warning"}`}>
                          Deadline {clock?.fulfillment_deadline ? new Date(clock.fulfillment_deadline).toLocaleString() : "—"}
                          {clock?.fulfillment_breached ? " (breached)" : ""}
                        </p>
                        {blockers.length > 0 ? (
                          <p className="mt-1.5 text-xs text-faint">{blockers.length} handover item(s) blocking readiness</p>
                        ) : (
                          <form action={markFulfillmentComplete} className="mt-2">
                            <input type="hidden" name="client_id" value={client.id} />
                            <Button className="!px-3 !py-1 text-xs">Mark fulfillment complete</Button>
                          </form>
                        )}
                      </>
                    )}
                  </Card>
                  <Card>
                    <p className="text-xs font-medium uppercase tracking-wide text-faint">Go-live · signed + 7d</p>
                    {client.go_live_completed_at ? (
                      <p className="mt-1.5 text-success">Live {new Date(client.go_live_completed_at).toLocaleString()}</p>
                    ) : (
                      <>
                        <p className={`mt-1.5 ${clock?.go_live_breached ? "text-danger" : "text-warning"}`}>
                          Deadline {clock?.go_live_deadline ? new Date(clock.go_live_deadline).toLocaleString() : "—"}
                          {clock?.go_live_breached ? " (breached)" : ""}
                        </p>
                        <form action={markGoLiveComplete} className="mt-2">
                          <input type="hidden" name="client_id" value={client.id} />
                          <Button disabled={!client.fulfillment_completed_at || !hasActiveRep} className="!px-3 !py-1 text-xs">
                            Mark go-live complete
                          </Button>
                        </form>
                        {client.fulfillment_completed_at && !hasActiveRep && (
                          <p className="mt-1.5 text-xs text-faint">Blocked, no rep has completed trial review as active yet.</p>
                        )}
                      </>
                    )}
                  </Card>
                  <Card>
                    <p className="text-xs font-medium uppercase tracking-wide text-faint">Rep assignment</p>
                    {(assignments ?? []).length === 0 ? (
                      <>
                        <p className="mt-1.5 text-warning">No rep matched yet</p>
                        <Link href="/reps" className="mt-2 inline-block text-xs text-accent underline">
                          Go to Talent to match one →
                        </Link>
                      </>
                    ) : (
                      <ul className="mt-1.5 space-y-1">
                        {(assignments ?? []).map((a) => (
                          <li key={a.id} className="flex items-center justify-between text-sm">
                            <Link href={`/reps/${a.rep_id}`} className="text-foreground hover:underline">
                              {repNameByIdForAssignments.get(a.rep_id) ?? "Unknown"}
                            </Link>
                            <Badge tone={a.status === "active" ? "success" : "warning"}>{a.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </section>
              ),
            },
            {
              key: "handover",
              label: "Handover",
              badge: blockers.length > 0 ? <Badge tone="danger">{blockers.length}</Badge> : undefined,
              content: (
                <section>
                  <SectionTitle>Complete Sales Handover</SectionTitle>
                  <ul className="space-y-2">
                    {(handover ?? []).map((h) => (
                      <li key={h.id}>
                        <Card className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-foreground">{h.label}</p>
                            <p className="text-xs text-faint">
                              <span className="capitalize">{h.category.replace(/_/g, " ")}</span> · Owner: {h.owner}
                            </p>
                          </div>
                          <form action={updateHandoverItemStatus} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={h.id} />
                            <input type="hidden" name="client_id" value={client.id} />
                            <Select key={h.status} name="status" defaultValue={h.status} className="!px-2 !py-1 text-xs">
                              <option value="missing">missing</option>
                              <option value="submitted">submitted</option>
                              <option value="verified">verified</option>
                              <option value="not_applicable">not applicable</option>
                            </Select>
                            <Button variant="secondary" className="!px-2 !py-1 text-xs">
                              Save
                            </Button>
                          </form>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            },
            {
              key: "opportunities",
              label: "Opportunities",
              badge: (opportunities ?? []).length > 0 ? <Badge tone="neutral">{(opportunities ?? []).length}</Badge> : undefined,
              content: (
                <section>
                  <SectionTitle
                    action={
                      <Link href={`/opportunities/new?client_id=${client.id}`}>
                        <Button variant="secondary" className="text-sm">
                          + Log booked call
                        </Button>
                      </Link>
                    }
                  >
                    Opportunities
                  </SectionTitle>
                  <ul className="space-y-2">
                    {(opportunities ?? []).map((o) => (
                      <li key={o.id}>
                        <Card className="flex items-center justify-between transition-all hover:-translate-y-0.5 hover:border-accent/40">
                          <Link href={`/opportunities/${o.id}`} className="text-sm text-foreground">
                            {o.prospect_name}
                          </Link>
                          <Badge>{o.custom_stage_label ?? o.stage.replace(/_/g, " ")}</Badge>
                        </Card>
                      </li>
                    ))}
                    {(opportunities ?? []).length === 0 && <EmptyState title="No booked calls yet for this client." />}
                  </ul>
                </section>
              ),
            },
            {
              key: "notes",
              label: "Notes",
              content: <NotesThread subjectType="client" subjectId={client.id} clientId={client.id} revalidatePath={`/clients/${client.id}`} />,
            },
            {
              key: "finance",
              label: "Finance",
              content: (
                <section>
                  <SectionTitle
                    action={
                      <Link href="/finance">
                        <Button variant="secondary" className="text-sm">
                          Create invoice
                        </Button>
                      </Link>
                    }
                  >
                    Invoices
                  </SectionTitle>
                  <Card className="mb-4 text-sm">
                    <p className="text-2xl font-semibold text-foreground">{money(cashCollected)}</p>
                    <p className="mt-1 text-xs text-faint">Collected via paid invoices</p>
                  </Card>
                  <ul className="space-y-2">
                    {(invoices ?? []).map((inv) => (
                      <li key={inv.id}>
                        <Card className="flex items-center justify-between text-sm">
                          <div>
                            <p className="text-foreground">{inv.description}</p>
                            {inv.due_date && <p className="text-xs text-faint">Due {new Date(inv.due_date).toLocaleDateString()}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rr-fin-num text-muted">{money(Number(inv.amount))}</span>
                            <Badge tone={INVOICE_TONE[inv.status as keyof typeof INVOICE_TONE] ?? "neutral"}>{inv.status}</Badge>
                          </div>
                        </Card>
                      </li>
                    ))}
                    {(invoices ?? []).length === 0 && <EmptyState title="No invoices for this client yet." />}
                  </ul>
                </section>
              ),
            },
            {
              key: "library",
              label: "Library",
              content: (
                <section>
                  <SectionTitle
                    action={
                      <Link href="/library">
                        <Button variant="secondary" className="text-sm">
                          Add resource
                        </Button>
                      </Link>
                    }
                  >
                    Client resources
                  </SectionTitle>
                  <ul className="space-y-2">
                    {(libraryItems ?? []).map((item) => (
                      <li key={item.id}>
                        <Card className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{item.title}</span>
                          <Badge tone="neutral">{item.type}</Badge>
                        </Card>
                      </li>
                    ))}
                    {(libraryItems ?? []).length === 0 && (
                      <EmptyState title="No client-specific resources yet." hint="Scope a Library folder or item to this client to see it here." />
                    )}
                  </ul>
                </section>
              ),
            },
            {
              key: "documents",
              label: "Documents",
              content: (
                <section>
                  <SectionTitle
                    action={
                      <Link href="/documents">
                        <Button variant="secondary" className="text-sm">
                          New document
                        </Button>
                      </Link>
                    }
                  >
                    Agreements &amp; documents
                  </SectionTitle>
                  <ul className="space-y-2">
                    {(agreementDocs ?? []).map((doc) => (
                      <li key={doc.id}>
                        <Link href={`/documents/${doc.id}`}>
                          <Card className="flex items-center justify-between text-sm transition-all hover:-translate-y-0.5 hover:border-accent/40">
                            <span className="text-foreground">{doc.title}</span>
                            <Badge tone="neutral">{doc.status.replace(/_/g, " ")}</Badge>
                          </Card>
                        </Link>
                      </li>
                    ))}
                    {(agreementDocs ?? []).length === 0 && <EmptyState title="No documents for this client yet." />}
                  </ul>
                </section>
              ),
            },
            {
              key: "history",
              label: "History",
              content: (
                <section>
                  <SectionTitle>Activity timeline</SectionTitle>
                  <ul className="space-y-2 border-l border-border pl-4">
                    {timeline.map((e, i) => (
                      <li key={i} className="relative text-sm">
                        <span
                          className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${
                            { neutral: "bg-faint", success: "bg-success", warning: "bg-warning", danger: "bg-danger", accent: "bg-accent" }[e.tone]
                          }`}
                        />
                        <p className="text-foreground">{e.label}</p>
                        <p className="text-xs text-faint">{new Date(e.at).toLocaleString()}</p>
                      </li>
                    ))}
                    {timeline.length === 0 && <EmptyState title="No activity yet." />}
                  </ul>
                </section>
              ),
            },
            {
              key: "workflow",
              label: "Workflow",
              content: (
                <section>
                  <SectionTitle>This client's pipeline vocabulary</SectionTitle>
                  <p className="mb-4 text-sm text-muted">
                    The underlying stage (booked, follow-up, won, lost) never changes, automation and reporting stay correct. This only
                    changes what {client.name} calls each stage.
                  </p>
                  <ul className="space-y-2">
                    {UNIVERSAL_STAGES.map((stage) => {
                      const existing = stageLabelByStage.get(stage);
                      return (
                        <li key={stage}>
                          <Card className="flex items-center justify-between gap-3 text-sm">
                            <div className="w-32 shrink-0">
                              <p className="font-medium capitalize text-foreground">{stage.replace(/_/g, " ")}</p>
                              <p className="text-xs text-faint">{STAGE_HINT[stage]}</p>
                            </div>
                            <form action={setClientStageLabel} className="flex flex-1 gap-2">
                              <input type="hidden" name="client_id" value={client.id} />
                              <input type="hidden" name="stage" value={stage} />
                              <Input key={existing?.label ?? stage} name="label" defaultValue={existing?.label ?? ""} placeholder={`Custom label for "${stage}"`} className="flex-1 text-xs" />
                              <Button type="submit" variant="secondary" className="!px-3 !py-1.5 text-xs">
                                Save
                              </Button>
                            </form>
                            {existing && (
                              <form action={removeClientStageLabel}>
                                <input type="hidden" name="id" value={existing.id} />
                                <input type="hidden" name="client_id" value={client.id} />
                                <input type="hidden" name="stage" value={stage} />
                                <button className="text-xs text-faint hover:text-danger">Reset</button>
                              </form>
                            )}
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
