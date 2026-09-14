import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { saveTemplateAndSend, attachExecutedCopy, approveStructuredTerms } from "../actions";
import { PageHeader, Badge, Card, Field, Input, Select, Button, Textarea } from "@/components/ui";
import { CONTRACT_PLACEHOLDERS } from "@/lib/contractTemplate";
import CopySignLink from "./CopySignLink";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
  if (!doc) notFound();

  const { data: signature } =
    doc.status === "executed"
      ? await supabase.from("document_signatures").select("*").eq("document_id", id).order("signed_at", { ascending: false }).limit(1).single()
      : { data: null };

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
      <div className="mx-auto max-w-xl px-6 py-10">
        <PageHeader title={doc.title} subtitle={<>{doc.doc_type} · <Badge>{doc.status.replace(/_/g, " ")}</Badge></>} />

        {doc.status === "draft" && (
          <form action={saveTemplateAndSend} className="mb-4">
            <Card className="space-y-3">
              <input type="hidden" name="id" value={doc.id} />
              <p className="text-sm text-muted">
                Write the actual contract text below. Available placeholders:{" "}
                {CONTRACT_PLACEHOLDERS.map((p) => (
                  <code key={p} className="mx-0.5 rounded bg-surface-subtle px-1 py-0.5 text-xs">
                    {`{{${p}}}`}
                  </code>
                ))}
              </p>
              <Textarea name="body_template" required rows={14} placeholder="This agreement is entered into between..." className="w-full font-mono text-xs" />
              <Button>Save &amp; send for signature</Button>
            </Card>
          </form>
        )}

        {doc.status === "sent_for_signature" && (
          <>
            <Card className="mb-4">
              <p className="mb-2 text-sm text-muted">Share this link with the signer, no account needed on their end.</p>
              <CopySignLink documentId={doc.id} />
            </Card>
            <form action={attachExecutedCopy} className="mb-4">
              <Card className="space-y-3">
                <input type="hidden" name="id" value={doc.id} />
                <p className="text-xs text-faint">Signed outside this tool instead? Attach the evidence link here.</p>
                <Field label="Executed copy link/reference">
                  <Input name="executed_copy_url" placeholder="Link to signed PDF, or evidence reference" />
                </Field>
                <Button variant="secondary">Attach executed copy</Button>
              </Card>
            </form>
          </>
        )}

        {doc.status === "executed" && doc.rendered_body && (
          <Card className="mb-4">
            <p className="mb-3 text-sm font-medium text-success">Signed</p>
            <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-surface-subtle p-4 text-sm text-foreground">{doc.rendered_body}</pre>
            {signature && (
              <div className="border-t border-border pt-3">
                <p className="rr-signature text-foreground">{signature.signer_name}</p>
                {signature.signer_title && <p className="text-xs text-faint">{signature.signer_title}</p>}
                <p className="text-xs text-faint">Signed {new Date(signature.signed_at).toLocaleString()}</p>
              </div>
            )}
          </Card>
        )}

        {doc.status === "executed" && !doc.terms_approved && (
          <form action={approveStructuredTerms} className="mb-4">
            <Card className="space-y-3 border-success/30 bg-success-bg/40">
              <input type="hidden" name="id" value={doc.id} />
              {doc.executed_copy_url && (
                <p className="text-sm text-success">
                  Executed copy:{" "}
                  <a href={doc.executed_copy_url} className="underline">
                    {doc.executed_copy_url}
                  </a>
                </p>
              )}
              {doc.client_id && (
                <Field label="RR rate (cash %, e.g. 0.10)">
                  <Input name="rr_rate" type="number" step="0.01" min="0" max="1" />
                </Field>
              )}
              {(assignments ?? []).length > 0 && (
                <>
                  <Field label="Rep assignment">
                    <Select name="rep_assignment_id" className="w-full">
                      <option value="">None</option>
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
