"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { fillTemplate } from "@/lib/contractTemplate";

// §16 — prepare an agreement from a template. Draft is distinct from signed.
export async function createDocument(formData: FormData) {
  const client_id = String(formData.get("client_id")) || null;
  const doc_type = String(formData.get("doc_type"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({ client_id, doc_type, title, created_by: user?.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

// §16 — save the founder-authored contract text (with {{placeholders}}) and
// move to sent_for_signature so the /sign link becomes live. The actual
// legal language is never invented here — it's whatever the founder pastes.
export async function saveTemplateAndSend(formData: FormData) {
  const id = String(formData.get("id"));
  const body_template = String(formData.get("body_template") ?? "").trim();
  if (!body_template) throw new Error("Contract text is required before sending for signature");

  const supabase = await createClient();
  await supabase.from("documents").update({ body_template, status: "sent_for_signature" }).eq("id", id);
  revalidatePath(`/documents/${id}`);
}

// §16 — store the executed copy and effective date. The executed document is
// authoritative; a draft never silently becomes "signed" without this evidence.
export async function attachExecutedCopy(formData: FormData) {
  const id = String(formData.get("id"));
  const executed_copy_url = String(formData.get("executed_copy_url") ?? "").trim();
  if (!executed_copy_url) throw new Error("An executed copy link/reference is required");

  const supabase = await createClient();
  await supabase
    .from("documents")
    .update({ status: "executed", executed_copy_url, effective_date: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/documents/${id}`);
}

// §16/§20 — approving structured terms is what actually changes Finance
// configuration; it's audited and requires the executed copy to exist first.
export async function approveStructuredTerms(formData: FormData) {
  const id = String(formData.get("id"));
  const rr_rate = formData.get("rr_rate") ? Number(formData.get("rr_rate")) : null;
  const rep_assignment_id = String(formData.get("rep_assignment_id") ?? "") || null;
  const rep_rate = formData.get("rep_rate") ? Number(formData.get("rep_rate")) : null;
  const rep_basis = String(formData.get("rep_basis") ?? "client_cash");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: doc } = await supabase.from("documents").select("client_id, status").eq("id", id).single();
  if (!doc || doc.status !== "executed") throw new Error("Only an executed document's terms can be approved");

  const structured_terms = { rr_rate, rep_assignment_id, rep_rate, rep_basis };

  await supabase
    .from("documents")
    .update({
      structured_terms,
      terms_approved: true,
      terms_approved_by: user?.id,
      terms_approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (rr_rate !== null && doc.client_id) {
    await supabase
      .from("clients")
      .update({ rr_rate_basis: { type: "cash_percentage", rr_rate } })
      .eq("id", doc.client_id);
  }

  if (rep_assignment_id && rep_rate !== null) {
    await supabase
      .from("rep_assignments")
      .update({ compensation_terms: { type: "percentage", rate: rep_rate, basis: rep_basis } })
      .eq("id", rep_assignment_id);
  }

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    action: "approve_structured_terms",
    target_type: "document",
    target_id: id,
    after: structured_terms,
  });

  revalidatePath(`/documents/${id}`);
  revalidatePath("/finance");
}

// Public signing action — the counterparty has no OS login, so this runs
// with the service role and only touches one row it's explicitly allowed
// to move: a document that is actually awaiting signature. Typing your name
// here is the signature; we record it plus a timestamp and best-effort IP.
export async function submitSignature(formData: FormData) {
  const documentId = String(formData.get("document_id"));
  const signer_name = String(formData.get("signer_name") ?? "").trim();
  const signer_title = String(formData.get("signer_title") ?? "").trim() || null;
  if (!signer_name) throw new Error("Your name is required to sign");

  const supabase = createServiceClient();
  const { data: doc } = await supabase.from("documents").select("id, status, body_template, client_id").eq("id", documentId).single();
  if (!doc || doc.status !== "sent_for_signature" || !doc.body_template) {
    throw new Error("This document is not currently open for signature");
  }

  let clientName = "";
  if (doc.client_id) {
    const { data: client } = await supabase.from("clients").select("name").eq("id", doc.client_id).single();
    clientName = client?.name ?? "";
  }

  const rendered_body = fillTemplate(doc.body_template, {
    signer_name,
    signer_title: signer_title ?? "",
    client_name: clientName,
    date: new Date().toLocaleDateString(),
  });

  const ip_address = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await supabase.from("document_signatures").insert({ document_id: documentId, signer_name, signer_title, ip_address });
  await supabase
    .from("documents")
    .update({ status: "executed", rendered_body, effective_date: new Date().toISOString() })
    .eq("id", documentId);

  redirect(`/documents/${documentId}/sign?done=1`);
}
