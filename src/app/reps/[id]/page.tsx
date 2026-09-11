import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { notFound } from "next/navigation";
import {
  updateRecruitingStatus,
  assignRepToClient,
  startLiveTrial,
  reviewTrial,
  linkRepProfile,
} from "../actions";

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

  const [{ data: rep }, { data: assignments }, { data: clients }] = await Promise.all([
    supabase.from("reps").select("*").eq("id", id).single(),
    supabase.from("rep_assignments").select("*").eq("rep_id", id).order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  if (!rep) notFound();
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{rep.full_name}</h1>
            <p className="text-sm text-neutral-500">{rep.email} · {rep.capabilities.join(", ") || "no role set"}</p>
          </div>
          <form action={updateRecruitingStatus} className="flex items-center gap-2">
            <input type="hidden" name="rep_id" value={rep.id} />
            <select
              name="recruiting_status"
              defaultValue={rep.recruiting_status}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm"
            >
              {RECRUITING_STATUSES.map((s) => (
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

        <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
          <p>Geography: {rep.geography ?? "—"} · Timezone: {rep.timezone ?? "—"}</p>
          <p className="mt-1">
            Claimed cash collected: {rep.claimed_cash_collected ?? "—"} (unverified claim, per §10.3)
          </p>
          {rep.evidence_source && <p className="mt-1 text-neutral-400">Evidence: {rep.evidence_source}</p>}
          {rep.profile_id ? (
            <p className="mt-2 text-emerald-400">Platform login linked — can access their own workspace at /my.</p>
          ) : (
            <form action={linkRepProfile} className="mt-2">
              <input type="hidden" name="rep_id" value={rep.id} />
              <button className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800">
                Link platform login (matches by email — they must sign in once first)
              </button>
            </form>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Client assignments</h2>
          <form action={assignRepToClient} className="mb-4 flex gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
            <input type="hidden" name="rep_id" value={rep.id} />
            <select name="client_id" required className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm">
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select name="role" className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm">
              <option value="closer">Closer</option>
              <option value="setter">Setter</option>
            </select>
            <button className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900">Assign</button>
          </form>

          <ul className="space-y-3">
            {(assignments ?? []).map((a) => (
              <li key={a.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">
                    {clientNameById.get(a.client_id) ?? "Unknown client"} · {a.role}
                  </p>
                  <span className="text-xs text-neutral-400">{a.status}</span>
                </div>

                {a.status === "training" && (
                  <form action={startLiveTrial}>
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <input type="hidden" name="rep_id" value={rep.id} />
                    <button className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-900">
                      Start 7-day live trial
                    </button>
                  </form>
                )}

                {a.status === "trial" && (
                  <div>
                    <p className="mb-2 text-xs text-neutral-500">
                      Trial started {a.trial_started_at ? new Date(a.trial_started_at).toLocaleString() : "—"}
                    </p>
                    <form action={reviewTrial} className="space-y-2">
                      <input type="hidden" name="assignment_id" value={a.id} />
                      <input type="hidden" name="rep_id" value={rep.id} />
                      <textarea
                        name="trial_review_result"
                        placeholder="Human evaluation: call structure, objection handling, follow-up discipline, deals closed..."
                        rows={2}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <button name="outcome" value="active" className="rounded-lg bg-emerald-900 px-3 py-1 text-xs text-emerald-300">
                          Confirm active
                        </button>
                        <button name="outcome" value="bench" className="rounded-lg bg-amber-900 px-3 py-1 text-xs text-amber-300">
                          Bench
                        </button>
                        <button name="outcome" value="removed" className="rounded-lg bg-red-950 px-3 py-1 text-xs text-red-300">
                          Remove
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {a.trial_review_result && (
                  <p className="mt-2 text-xs text-neutral-500">Review: {a.trial_review_result}</p>
                )}
              </li>
            ))}
            {(assignments ?? []).length === 0 && (
              <p className="text-sm text-neutral-500">Not assigned to any client yet.</p>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
