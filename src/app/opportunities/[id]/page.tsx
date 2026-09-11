import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import NotesThread from "@/components/NotesThread";
import { notFound } from "next/navigation";
import { logCallOutcome } from "../actions";

const OUTCOMES = [
  "pending",
  "completed_won",
  "completed_follow_up",
  "completed_lost",
  "no_show",
  "cancelled",
  "rescheduled",
];

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: opp } = await supabase.from("opportunities").select("*").eq("id", id).single();
  if (!opp) notFound();

  const [{ data: calls }, { data: client }] = await Promise.all([
    supabase.from("calls").select("*").eq("opportunity_id", id).order("scheduled_at", { ascending: false }),
    supabase.from("clients").select("name").eq("id", opp.client_id).single(),
  ]);
  const clientName = client?.name ?? "Unknown client";

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold">{opp.prospect_name}</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {clientName} · stage: {opp.stage}
        </p>

        <h2 className="mb-3 text-lg font-medium">Calls</h2>
        <ul className="space-y-4">
          {(calls ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-neutral-400">{new Date(c.scheduled_at).toLocaleString()}</p>
                <div className="flex gap-2 text-xs">
                  <MediaBadge label="Recording" status={c.recording_status} />
                  <MediaBadge label="Transcript" status={c.transcript_status} />
                </div>
              </div>

              {c.logged_at ? (
                <div className="text-sm">
                  <p>
                    Outcome: <span className="font-medium">{c.outcome}</span>
                  </p>
                  {c.notes && <p className="mt-1 text-neutral-400">{c.notes}</p>}
                  {c.agreed_next_action && (
                    <p className="mt-1 text-neutral-400">Next: {c.agreed_next_action}</p>
                  )}
                  {c.deal_value != null && <p className="mt-1 text-neutral-400">Value: ${c.deal_value}</p>}
                </div>
              ) : (
                <form action={logCallOutcome} className="space-y-2">
                  <input type="hidden" name="call_id" value={c.id} />
                  <input type="hidden" name="opportunity_id" value={opp.id} />
                  <label className="block text-xs text-neutral-400">
                    Outcome
                    <select
                      name="outcome"
                      required
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
                    >
                      {OUTCOMES.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-neutral-400">
                    Notes
                    <textarea
                      name="notes"
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    Agreed next action
                    <input
                      name="agreed_next_action"
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    Next call date
                    <input
                      type="datetime-local"
                      name="next_call_at"
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    Deal value (if won)
                    <input
                      type="number"
                      name="deal_value"
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button className="w-full rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900">
                    Log outcome
                  </button>
                </form>
              )}
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
  const color =
    status === "available" ? "text-emerald-400" : status === "failed" ? "text-red-400" : "text-neutral-500";
  return (
    <span className={color}>
      {label}: {status}
    </span>
  );
}
