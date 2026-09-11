import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { notFound } from "next/navigation";
import { markSentForSignature, attachExecutedCopy, approveStructuredTerms } from "../actions";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
  if (!doc) notFound();

  const { data: assignments } = doc.client_id
    ? await supabase.from("rep_assignments").select("id, role, rep_id").eq("client_id", doc.client_id)
    : { data: [] };
  const repIds = (assignments ?? []).map((a) => a.rep_id);
  const { data: assignmentReps } = repIds.length
    ? await supabase.from("reps").select("id, full_name").in("id", repIds)
    : { data: [] };
  const repNameById = new Map((assignmentReps ?? []).map((r) => [r.id, r.full_name]));

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold">{doc.title}</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {doc.doc_type} · {doc.status}
        </p>

        {doc.status === "draft" && (
          <form action={markSentForSignature} className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <input type="hidden" name="id" value={doc.id} />
            <p className="mb-2 text-sm text-neutral-400">
              No e-signature provider is connected — mark sent when the document has actually been sent through
              whatever process is in use.
            </p>
            <button className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900">
              Mark sent for signature
            </button>
          </form>
        )}

        {doc.status === "sent_for_signature" && (
          <form action={attachExecutedCopy} className="mb-4 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <input type="hidden" name="id" value={doc.id} />
            <label className="block text-sm">
              Executed copy link/reference
              <input
                name="executed_copy_url"
                required
                placeholder="Link to signed PDF, or evidence reference"
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900">
              Attach executed copy
            </button>
          </form>
        )}

        {doc.status === "executed" && !doc.terms_approved && (
          <form action={approveStructuredTerms} className="mb-4 space-y-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4">
            <input type="hidden" name="id" value={doc.id} />
            <p className="text-sm text-emerald-300">
              Executed: <a href={doc.executed_copy_url ?? "#"} className="underline">{doc.executed_copy_url}</a>
            </p>
            {doc.client_id && (
              <label className="block text-sm">
                RR rate (cash %, e.g. 0.10)
                <input
                  name="rr_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
                />
              </label>
            )}
            {(assignments ?? []).length > 0 && (
              <>
                <label className="block text-sm">
                  Rep assignment
                  <select name="rep_assignment_id" className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— none —</option>
                    {(assignments ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {repNameById.get(a.rep_id) ?? "Unknown"} ({a.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Rep rate
                  <input
                    name="rep_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  Rep rate basis
                  <select name="rep_basis" className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm">
                    <option value="client_cash">% of client cash collected</option>
                    <option value="rr_share">% of RR's share</option>
                  </select>
                </label>
              </>
            )}
            <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white">
              Approve structured terms
            </button>
          </form>
        )}

        {doc.terms_approved && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
            <p className="mb-2 font-medium">Approved terms</p>
            <pre className="overflow-x-auto text-xs text-neutral-400">{JSON.stringify(doc.structured_terms, null, 2)}</pre>
            <p className="mt-2 text-xs text-neutral-500">
              Approved {doc.terms_approved_at ? new Date(doc.terms_approved_at).toLocaleString() : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
