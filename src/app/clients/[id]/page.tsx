import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import NotesThread from "@/components/NotesThread";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  updateHandoverItemStatus,
  updateLifecycleState,
  markFulfillmentComplete,
  markGoLiveComplete,
} from "../actions";

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

  const [{ data: client }, { data: clock }, { data: handover }, { data: opportunities }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("client_clocks").select("*").eq("client_id", id).single(),
    supabase.from("handover_items").select("*").eq("client_id", id).order("category"),
    supabase
      .from("opportunities")
      .select("id, prospect_name, stage, value, first_booked_at")
      .eq("client_id", id)
      .order("first_booked_at", { ascending: false }),
  ]);

  if (!client) notFound();

  const blockers = (handover ?? []).filter((h) => h.blocks_readiness && h.status !== "verified" && h.status !== "not_applicable");

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <p className="text-sm text-neutral-500">
              {client.workflow_type} ·{" "}
              <Link href={`/clients/${client.id}/report`} className="underline hover:text-neutral-300">
                Reports
              </Link>
            </p>
          </div>
          <form action={updateLifecycleState} className="flex items-center gap-2">
            <input type="hidden" name="client_id" value={client.id} />
            <select
              name="lifecycle_state"
              defaultValue={client.lifecycle_state}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm"
            >
              {LIFECYCLE_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
              Update
            </button>
          </form>
        </div>

        <section className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Fulfillment (target: signed + 48h)</p>
            {client.fulfillment_completed_at ? (
              <p className="mt-1 text-emerald-400">
                Complete {new Date(client.fulfillment_completed_at).toLocaleString()}
              </p>
            ) : (
              <>
                <p className={`mt-1 ${clock?.fulfillment_breached ? "text-red-400" : "text-amber-400"}`}>
                  Deadline {clock?.fulfillment_deadline ? new Date(clock.fulfillment_deadline).toLocaleString() : "—"}
                  {clock?.fulfillment_breached ? " — breached" : ""}
                </p>
                {blockers.length > 0 ? (
                  <p className="mt-1 text-xs text-neutral-500">{blockers.length} handover item(s) blocking readiness</p>
                ) : (
                  <form action={markFulfillmentComplete} className="mt-2">
                    <input type="hidden" name="client_id" value={client.id} />
                    <button className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-900">
                      Mark fulfillment complete
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">Go-live (target: signed + 7d)</p>
            {client.go_live_completed_at ? (
              <p className="mt-1 text-emerald-400">Live {new Date(client.go_live_completed_at).toLocaleString()}</p>
            ) : (
              <>
                <p className={`mt-1 ${clock?.go_live_breached ? "text-red-400" : "text-amber-400"}`}>
                  Deadline {clock?.go_live_deadline ? new Date(clock.go_live_deadline).toLocaleString() : "—"}
                  {clock?.go_live_breached ? " — breached" : ""}
                </p>
                <form action={markGoLiveComplete} className="mt-2">
                  <input type="hidden" name="client_id" value={client.id} />
                  <button
                    disabled={!client.fulfillment_completed_at}
                    className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-900 disabled:opacity-40"
                  >
                    Mark go-live complete
                  </button>
                </form>
              </>
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Complete Sales Handover</h2>
          <ul className="space-y-2">
            {(handover ?? []).map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3"
              >
                <div>
                  <p className="text-sm">{h.label}</p>
                  <p className="text-xs text-neutral-500">
                    {h.category} · owner: {h.owner}
                  </p>
                </div>
                <form action={updateHandoverItemStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="client_id" value={client.id} />
                  <select
                    name="status"
                    defaultValue={h.status}
                    className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs"
                  >
                    <option value="missing">missing</option>
                    <option value="submitted">submitted</option>
                    <option value="verified">verified</option>
                    <option value="not_applicable">not applicable</option>
                  </select>
                  <button className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium">Opportunities</h2>
            <Link
              href={`/opportunities/new?client_id=${client.id}`}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              + Log booked call
            </Link>
          </div>
          <ul className="space-y-2">
            {(opportunities ?? []).map((o) => (
              <li key={o.id}>
                <Link
                  href={`/opportunities/${o.id}`}
                  className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3 hover:border-neutral-600"
                >
                  <p className="text-sm">{o.prospect_name}</p>
                  <span className="text-xs text-neutral-400">{o.stage}</span>
                </Link>
              </li>
            ))}
            {(opportunities ?? []).length === 0 && (
              <p className="text-sm text-neutral-500">No booked calls yet for this client.</p>
            )}
          </ul>
        </section>

        <section className="mt-10">
          <NotesThread subjectType="client" subjectId={client.id} clientId={client.id} revalidatePath={`/clients/${client.id}`} />
        </section>
      </div>
    </div>
  );
}
