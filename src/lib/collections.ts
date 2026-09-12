import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// §15.2 — shared by the founder's manual "verify" action and the Stripe
// webhook (a successful charge is itself sufficient verification evidence).
// Never duplicate this math — it decides what a rep actually gets paid.
export async function verifyCollectionCore(
  supabase: SupabaseClient<Database>,
  { collectionId, dealId, verifiedBy }: { collectionId: string; dealId: string; verifiedBy?: string },
) {
  const { data: collection } = await supabase
    .from("collections")
    .update({ status: "verified", verified_by: verifiedBy, verified_at: new Date().toISOString() })
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
      created_by: verifiedBy,
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
      await payRepCommission(supabase, {
        collectionId,
        clientId: opportunity.client_id,
        repId: opportunity.owner_rep_id,
        collectionAmount: collection.amount,
        currency: collection.currency,
        rrAmount,
        compensationTerms: assignment.compensation_terms as CompensationTerms,
        createdBy: verifiedBy,
      });
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
}

type CompensationTerms = { type: string; rate: number; basis: "client_cash" | "rr_share" };

// Shared by initial verification and late reconciliation — the commission
// math must never diverge between "paid on time" and "paid late" paths.
async function payRepCommission(
  supabase: SupabaseClient<Database>,
  opts: {
    collectionId: string;
    clientId: string;
    repId: string;
    collectionAmount: number;
    currency: string;
    rrAmount: number | null;
    compensationTerms: CompensationTerms;
    createdBy?: string;
  },
): Promise<number | null> {
  const { collectionId, clientId, repId, collectionAmount, currency, rrAmount, compensationTerms, createdBy } = opts;
  const base = compensationTerms.basis === "rr_share" ? (rrAmount ?? 0) : collectionAmount;
  const repAmount = compensationTerms.type === "percentage" ? base * compensationTerms.rate : null;
  if (repAmount === null) return null;

  const { data: ledgerEntry } = await supabase
    .from("ledger_entries")
    .insert({
      collection_id: collectionId,
      client_id: clientId,
      entry_type: "rep_commission_earned",
      amount: repAmount,
      currency,
      rep_id: repId,
      effective_terms: compensationTerms,
      created_by: createdBy,
    })
    .select("id")
    .single();

  await supabase.from("wallet_entries").insert({
    rep_id: repId,
    ledger_entry_id: ledgerEntry?.id,
    amount: repAmount,
    status: "pending_client_payment",
  });

  return repAmount;
}

// §15.2 reconciliation — compensation terms set (or changed) AFTER a
// collection was already verified must not silently leave that rep unpaid.
// Finds every verified collection for this rep+client that has an
// rr_receivable but no rep_commission_earned yet, pays it using the terms
// just saved, and writes an audit_log row per payment so "why did this
// commission appear late" is always answerable.
export async function reconcileMissingCommissions(
  supabase: SupabaseClient<Database>,
  { repId, clientId, actorId }: { repId: string; clientId: string; actorId?: string },
): Promise<{ recomputedCount: number; totalAmount: number }> {
  const { data: assignment } = await supabase
    .from("rep_assignments")
    .select("compensation_terms")
    .eq("rep_id", repId)
    .eq("client_id", clientId)
    .maybeSingle();
  const compensationTerms = assignment?.compensation_terms as CompensationTerms | null;
  if (!compensationTerms) return { recomputedCount: 0, totalAmount: 0 };

  const { data: opportunities } = await supabase.from("opportunities").select("id").eq("owner_rep_id", repId).eq("client_id", clientId);
  const oppIds = (opportunities ?? []).map((o) => o.id);
  if (oppIds.length === 0) return { recomputedCount: 0, totalAmount: 0 };

  const { data: deals } = await supabase.from("deals").select("id").in("opportunity_id", oppIds);
  const dealIds = (deals ?? []).map((d) => d.id);
  if (dealIds.length === 0) return { recomputedCount: 0, totalAmount: 0 };

  const { data: verifiedCollections } = await supabase
    .from("collections")
    .select("id, amount, currency")
    .in("deal_id", dealIds)
    .eq("status", "verified");
  if (!verifiedCollections?.length) return { recomputedCount: 0, totalAmount: 0 };

  const collectionIds = verifiedCollections.map((c) => c.id);

  const { data: existingRepEntries } = await supabase
    .from("ledger_entries")
    .select("collection_id")
    .eq("rep_id", repId)
    .eq("entry_type", "rep_commission_earned")
    .in("collection_id", collectionIds);
  const alreadyPaid = new Set((existingRepEntries ?? []).map((e) => e.collection_id));

  const { data: rrEntries } = await supabase
    .from("ledger_entries")
    .select("collection_id, amount")
    .eq("entry_type", "rr_receivable")
    .in("collection_id", collectionIds);
  const rrAmountByCollection = new Map((rrEntries ?? []).map((e) => [e.collection_id, Number(e.amount)]));

  let recomputedCount = 0;
  let totalAmount = 0;
  for (const collection of verifiedCollections) {
    if (alreadyPaid.has(collection.id)) continue;
    const repAmount = await payRepCommission(supabase, {
      collectionId: collection.id,
      clientId,
      repId,
      collectionAmount: Number(collection.amount),
      currency: collection.currency,
      rrAmount: rrAmountByCollection.get(collection.id) ?? null,
      compensationTerms,
      createdBy: actorId,
    });
    if (repAmount === null) continue;
    recomputedCount++;
    totalAmount += repAmount;
    await supabase.from("audit_log").insert({
      actor_id: actorId,
      actor_type: "human",
      action: "reconcile_missing_commission",
      target_type: "collection",
      target_id: collection.id,
      after: { rep_id: repId, amount: repAmount, compensation_terms: compensationTerms },
    });
  }

  if (recomputedCount > 0) {
    await supabase
      .from("action_items")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("rep_id", repId)
      .eq("client_id", clientId)
      .eq("title", "Rep commission terms not configured")
      .in("status", ["open", "in_progress"]);
  }

  return { recomputedCount, totalAmount };
}
