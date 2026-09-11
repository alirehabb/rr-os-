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
            created_by: verifiedBy,
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
}
