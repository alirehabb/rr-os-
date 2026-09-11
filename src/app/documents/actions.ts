"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

// §16 — track through the configured signature process. No e-sign provider
// is connected, so this stays a manual, visibly-labeled attested state.
export async function markSentForSignature(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("documents").update({ status: "sent_for_signature" }).eq("id", id);
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
