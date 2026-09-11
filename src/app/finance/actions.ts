"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  const { data: collection } = await supabase
    .from("collections")
    .update({ status: "verified", verified_by: user?.id, verified_at: new Date().toISOString() })
    .eq("id", collectionId)
    .select("amount, currency")
    .single();
  if (!collection) return;

  const { data: deal } = await supabase.from("deals").select("opportunity_id").eq("id", dealId).single();
  if (!deal) return;

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("client_id, owner_rep_id")
    .eq("id", deal.opportunity_id)
    .single();
  if (!opportunity) return;

  const { data: client } = await supabase.from("clients").select("rr_rate_basis").eq("id", opportunity.client_id).single();

  if (!client?.rr_rate_basis) {
    await supabase.from("action_items").insert({
      title: "RR commission terms not configured",
      reason: `Verified $${collection.amount} collection for a client with no approved RR rate/basis on file (§15.2). Calculation is blocked until terms are entered.`,
      client_id: opportunity.client_id,
      money_impact: collection.amount,
    });
    revalidatePath("/finance");
    return;
  }

  const rateBasis = client.rr_rate_basis as { type: string; rr_rate: number };
  const rrAmount = rateBasis.type === "cash_percentage" ? collection.amount * rateBasis.rr_rate : null;

  if (rrAmount !== null) {
    await supabase.from("ledger_entries").insert({
      collection_id: collectionId,
      client_id: opportunity.client_id,
      entry_type: "rr_receivable",
      amount: rrAmount,
      currency: collection.currency,
      effective_terms: client.rr_rate_basis,
      created_by: user?.id,
    });
  }

  if (opportunity.owner_rep_id) {
    const { data: assignment } = await supabase
      .from("rep_assignments")
      .select("compensation_terms")
      .eq("rep_id", opportunity.owner_rep_id)
      .eq("client_id", opportunity.client_id)
      .maybeSingle();

    if (assignment?.compensation_terms) {
      const repTerms = assignment.compensation_terms as { type: string; rate: number; basis: "client_cash" | "rr_share" };
      const base = repTerms.basis === "rr_share" ? (rrAmount ?? 0) : collection.amount;
      const repAmount = repTerms.type === "percentage" ? base * repTerms.rate : null;

      if (repAmount !== null) {
        const { data: ledgerEntry } = await supabase
          .from("ledger_entries")
          .insert({
            collection_id: collectionId,
            client_id: opportunity.client_id,
            entry_type: "rep_commission_earned",
            amount: repAmount,
            currency: collection.currency,
            rep_id: opportunity.owner_rep_id,
            effective_terms: assignment.compensation_terms,
            created_by: user?.id,
          })
          .select("id")
          .single();

        await supabase.from("wallet_entries").insert({
          rep_id: opportunity.owner_rep_id,
          ledger_entry_id: ledgerEntry?.id,
          amount: repAmount,
          status: "pending_client_payment",
        });
      }
    } else {
      await supabase.from("action_items").insert({
        title: "Rep commission terms not configured",
        reason: `Verified collection for a rep with no approved compensation terms on file (§15.2). Rep payable cannot be calculated.`,
        rep_id: opportunity.owner_rep_id,
        client_id: opportunity.client_id,
        money_impact: collection.amount,
      });
    }
  }

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
  const supabase = await createClient();
  await supabase
    .from("rep_assignments")
    .update({ compensation_terms: { type: "percentage", rate, basis } })
    .eq("id", assignmentId);
  revalidatePath("/finance");
}
