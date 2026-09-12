"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyCollectionCore } from "@/lib/collections";

// §15.2 — a rep logging "payment collected" is a claim until verified.
export async function recordCollection(formData: FormData) {
  const deal_id = String(formData.get("deal_id"));
  const amount = Number(formData.get("amount"));
  const external_reference = String(formData.get("external_reference") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("collections").insert({
    deal_id,
    amount,
    external_reference,
    reported_by: user?.id,
  });

  revalidatePath("/finance");
}

// §15.2 — verifying a collection is what allows it to become RR receivable /
// rep-payable. If commission terms aren't configured yet, we still record the
// verified cash but block the calculation and flag it instead of inventing a rate.
export async function verifyCollection(formData: FormData) {
  const collectionId = String(formData.get("collection_id"));
  const dealId = String(formData.get("deal_id"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await verifyCollectionCore(supabase, { collectionId, dealId, verifiedBy: user?.id });
  revalidatePath("/finance");
}

// §15.3 — Finance/Admin can prepare a payout; only the founder's explicit
// approval below actually authorizes it, and "approved" is still not "paid".
export async function approvePayout(formData: FormData) {
  const walletEntryId = String(formData.get("wallet_entry_id"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("wallet_entries")
    .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq("id", walletEntryId)
    .eq("status", "payable");
  revalidatePath("/finance");
}

export async function markPayablePendingToPayable(formData: FormData) {
  const walletEntryId = String(formData.get("wallet_entry_id"));
  const supabase = await createClient();
  await supabase.from("wallet_entries").update({ status: "payable" }).eq("id", walletEntryId).eq("status", "pending_client_payment");
  revalidatePath("/finance");
}

// Recording an externally executed payment reference — this is not autonomous
// money movement, it's logging a transfer that already happened outside RR OS (§15.3).
export async function recordPayoutPaid(formData: FormData) {
  const walletEntryId = String(formData.get("wallet_entry_id"));
  const payment_reference = String(formData.get("payment_reference") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase
    .from("wallet_entries")
    .update({ status: "paid", paid_at: new Date().toISOString(), payment_reference })
    .eq("id", walletEntryId)
    .eq("status", "approved");
  revalidatePath("/finance");
}

// §24 — configuration register: real approved RR/rep rates must be entered
// explicitly, never invented by the builder.
export async function setClientRateBasis(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const rrRate = Number(formData.get("rr_rate"));
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ rr_rate_basis: { type: "cash_percentage", rr_rate: rrRate } })
    .eq("id", clientId);
  revalidatePath("/finance");
}

export async function setRepCompensationTerms(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id"));
  const rate = Number(formData.get("rate"));
  const basis = String(formData.get("basis"));
  const repId = String(formData.get("rep_id") ?? "");
  const supabase = await createClient();
  await supabase
    .from("rep_assignments")
    .update({ compensation_terms: { type: "percentage", rate, basis } })
    .eq("id", assignmentId);
  revalidatePath("/finance");
  if (repId) revalidatePath(`/reps/${repId}`);
}
