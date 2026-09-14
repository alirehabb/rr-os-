import { createServiceClient } from "@/lib/supabase/service";
import { submitSignature } from "../../actions";
import { fillTemplate } from "@/lib/contractTemplate";
import { Card, Field, Input, Button } from "@/components/ui";

export default async function SignDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;
  const supabase = createServiceClient();

  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();

  if (!doc) {
    return <CenteredMessage title="Document not found" />;
  }

  if (doc.status === "executed") {
    const { data: signature } = await supabase
      .from("document_signatures")
      .select("*")
      .eq("document_id", id)
      .order("signed_at", { ascending: false })
      .limit(1)
      .single();

    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card>
          <p className="mb-4 text-sm font-medium text-success">
            {done ? "Signed, thank you." : "This document has already been signed."}
          </p>
          <pre className="mb-6 whitespace-pre-wrap rounded-xl bg-surface-subtle p-4 text-sm text-foreground">{doc.rendered_body}</pre>
          {signature && (
            <div className="border-t border-border pt-4">
              <p className="rr-signature text-foreground">{signature.signer_name}</p>
              {signature.signer_title && <p className="text-xs text-faint">{signature.signer_title}</p>}
              <p className="text-xs text-faint">Signed {new Date(signature.signed_at).toLocaleString()}</p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (doc.status !== "sent_for_signature" || !doc.body_template) {
    return <CenteredMessage title="This document is not currently open for signature." />;
  }

  const preview = fillTemplate(doc.body_template, {
    signer_name: "_______________",
    signer_title: "",
    client_name: "",
    date: new Date().toLocaleDateString(),
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-1 text-xl font-semibold text-foreground">{doc.title}</h1>
      <p className="mb-6 text-sm text-muted">Review below, then type your name to sign.</p>

      <Card className="mb-6">
        <pre className="whitespace-pre-wrap text-sm text-foreground">{preview}</pre>
      </Card>

      <Card>
        <form action={submitSignature} className="space-y-4">
          <input type="hidden" name="document_id" value={id} />
          <Field label="Type your full legal name to sign">
            <Input name="signer_name" required placeholder="Jane Doe" />
          </Field>
          <Field label="Title (optional)">
            <Input name="signer_title" placeholder="e.g. CEO" />
          </Field>
          <p className="text-xs text-faint">
            By typing your name and clicking Sign, you agree this constitutes your electronic signature on this document.
          </p>
          <Button type="submit" className="w-full">
            Sign
          </Button>
        </form>
      </Card>
    </div>
  );
}

function CenteredMessage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-sm text-muted">{title}</p>
    </div>
  );
}
