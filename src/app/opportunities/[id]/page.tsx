import { createClient } from "@/lib/supabase/server";
import NotesThread from "@/components/NotesThread";
import { notFound } from "next/navigation";
import { logCallOutcome, attachCallMedia } from "../actions";
import { PageHeader, SectionTitle, Card, Badge, Button, Select, Textarea, Input, Field } from "@/components/ui";

const OUTCOMES = [
  "pending",
  "completed_won",
  "completed_follow_up",
  "completed_lost",
  "no_show",
  "cancelled",
  "rescheduled",
];

const STAGE_TONE = {
  upstream: "neutral",
  booked: "accent",
  follow_up: "warning",
  won: "success",
  lost: "danger",
} as const;

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: opp } = await supabase.from("opportunities").select("*").eq("id", id).single();
  if (!opp) notFound();

  const [{ data: calls }, { data: client }, { data: owner }] = await Promise.all([
    supabase.from("calls").select("*").eq("opportunity_id", id).order("scheduled_at", { ascending: false }),
    supabase.from("clients").select("name").eq("id", opp.client_id).single(),
    opp.owner_rep_id ? supabase.from("reps").select("full_name").eq("id", opp.owner_rep_id).single() : Promise.resolve({ data: null }),
  ]);
  const clientName = client?.name ?? "Unknown client";

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <PageHeader
          title={opp.prospect_name}
          subtitle={
            <>
              {clientName} · <Badge tone={STAGE_TONE[opp.stage]}>{opp.stage.replace("_", " ")}</Badge>
              {" · "}
              {owner ? <span>Owner: {owner.full_name}</span> : <span className="text-danger">Unowned — no active closer to route to</span>}
            </>
          }
        />

        <SectionTitle>Calls</SectionTitle>
        <ul className="space-y-4">
          {(calls ?? []).map((c) => (
            <li key={c.id}>
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-muted">{new Date(c.scheduled_at).toLocaleString()}</p>
                  <div className="flex gap-1.5">
                    <MediaBadge label="Recording" status={c.recording_status} />
                    <MediaBadge label="Transcript" status={c.transcript_status} />
                  </div>
                </div>

                {(c.recording_status !== "available" || c.transcript_status !== "available") && (
                  <form action={attachCallMedia} className="mb-3 flex gap-2 rounded-xl bg-surface-subtle p-2">
                    <input type="hidden" name="call_id" value={c.id} />
                    <input type="hidden" name="opportunity_id" value={opp.id} />
                    {c.recording_status !== "available" && (
                      <Input name="recording_url" placeholder="Recording link" className="text-xs" />
                    )}
                    {c.transcript_status !== "available" && (
                      <Input name="transcript_url" placeholder="Transcript link" className="text-xs" />
                    )}
                    <Button variant="secondary" className="!px-2 !py-1 text-xs shrink-0">
                      Attach
                    </Button>
                  </form>
                )}

                {c.logged_at ? (
                  <div className="text-sm">
                    <p className="text-foreground">
                      Outcome: <span className="font-medium">{c.outcome.replace(/_/g, " ")}</span>
                    </p>
                    {c.notes && <p className="mt-1 text-muted">{c.notes}</p>}
                    {c.agreed_next_action && <p className="mt-1 text-muted">Next: {c.agreed_next_action}</p>}
                    {c.deal_value != null && <p className="mt-1 text-muted">Value: ${c.deal_value}</p>}
                  </div>
                ) : (
                  <form action={logCallOutcome} className="space-y-2">
                    <input type="hidden" name="call_id" value={c.id} />
                    <input type="hidden" name="opportunity_id" value={opp.id} />
                    <Field label="Outcome">
                      <Select name="outcome" required className="w-full">
                        {OUTCOMES.map((o) => (
                          <option key={o} value={o}>
                            {o.replace(/_/g, " ")}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Notes">
                      <Textarea name="notes" rows={2} />
                    </Field>
                    <Field label="Agreed next action">
                      <Input name="agreed_next_action" />
                    </Field>
                    <Field label="Next call date">
                      <Input type="datetime-local" name="next_call_at" />
                    </Field>
                    <Field label="Deal value (if won)">
                      <Input type="number" name="deal_value" />
                    </Field>
                    <Button className="w-full">Log outcome</Button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <NotesThread
            subjectType="opportunity"
            subjectId={opp.id}
            clientId={opp.client_id}
            revalidatePath={`/opportunities/${opp.id}`}
          />
        </div>
      </div>
    </div>
  );
}

function MediaBadge({ label, status }: { label: string; status: string }) {
  const tone = status === "available" ? "success" : status === "failed" ? "danger" : "neutral";
  return (
    <Badge tone={tone}>
      {label}: {status}
    </Badge>
  );
}
