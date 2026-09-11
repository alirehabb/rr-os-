import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { notFound } from "next/navigation";
import { markSentForSignature, attachExecutedCopy, approveStructuredTerms } from "../actions";
import { PageHeader, Badge, Card, Field, Input, Select, Button } from "@/components/ui";

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
        <PageHeader title={doc.title} subtitle={<>{doc.doc_type} · <Badge>{doc.status.replace(/_/g, " ")}</Badge></>} />

        {doc.status === "draft" && (
          <form action={markSentForSignature} className="mb-4">
            <Card>
              <input type="hidden" name="id" value={doc.id} />
              <p className="mb-3 text-sm text-muted">
                No e-signature provider is connected — mark sent when the document has actually been sent through
                whatever process is in use.
              </p>
              <Button>Mark sent for signature</Button>
            </Card>
          </form>
        )}

        {doc.status === "sent_for_signature" && (
          <form action={attachExecutedCopy} className="mb-4">
            <Card className="space-y-3">
              <input type="hidden" name="id" value={doc.id} />
              <Field label="Executed copy link/reference">
                <Input name="executed_copy_url" required placeholder="Link to signed PDF, or evidence reference" />
              </Field>
              <Button>Attach executed copy</Button>
            </Card>
          </form>
        )}

        {doc.status === "executed" && !doc.terms_approved && (
          <form action={approveStructuredTerms} className="mb-4">
            <Card className="space-y-3 border-success/30 bg-success-bg/40">
              <input type="hidden" name="id" value={doc.id} />
              <p className="text-sm text-success">
                Executed:{" "}
                <a href={doc.executed_copy_url ?? "#"} className="underline">
                  {doc.executed_copy_url}
                </a>
              </p>
              {doc.client_id && (
                <Field label="RR rate (cash %, e.g. 0.10)">
                  <Input name="rr_rate" type="number" step="0.01" min="0" max="1" />
                </Field>
              )}
              {(assignments ?? []).length > 0 && (
                <>
                  <Field label="Rep assignment">
                    <Select name="rep_assignment_id" className="w-full">
                      <option value="">— none —</option>
                      {(assignments ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {repNameById.get(a.rep_id) ?? "Unknown"} ({a.role})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Rep rate">
                    <Input name="rep_rate" type="number" step="0.01" min="0" max="1" />
                  </Field>
                  <Field label="Rep rate basis">
                    <Select name="rep_basis" className="w-full">
                      <option value="client_cash">% of client cash collected</option>
                      <option value="rr_share">% of RR&apos;s share</option>
                    </Select>
                  </Field>
                </>
              )}
              <Button>Approve structured terms</Button>
            </Card>
          </form>
        )}

        {doc.terms_approved && (
          <Card className="text-sm">
            <p className="mb-2 font-medium text-foreground">Approved terms</p>
            <pre className="overflow-x-auto rounded-xl bg-surface-subtle p-3 text-xs text-muted">{JSON.stringify(doc.structured_terms, null, 2)}</pre>
            <p className="mt-2 text-xs text-faint">Approved {doc.terms_approved_at ? new Date(doc.terms_approved_at).toLocaleString() : ""}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
