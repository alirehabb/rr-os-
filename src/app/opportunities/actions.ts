"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type CallOutcome = Database["public"]["Enums"]["call_outcome"];
type Supabase = SupabaseClient<Database>;

// Simple round-robin pool: whichever active closer assigned to this client
// currently owns the fewest open opportunities gets the next booking. No AI
// matching — that's explicitly out of scope for now.
async function pickRoundRobinCloser(supabase: Supabase, clientId: string): Promise<string | null> {
  const { data: assignments } = await supabase
    .from("rep_assignments")
    .select("rep_id")
    .eq("client_id", clientId)
    .eq("role", "closer")
    .eq("status", "active");
  const closerIds = (assignments ?? []).map((a) => a.rep_id);
  if (closerIds.length === 0) return null;
  if (closerIds.length === 1) return closerIds[0];

  const { data: openOpps } = await supabase
    .from("opportunities")
    .select("owner_rep_id")
    .eq("client_id", clientId)
    .in("owner_rep_id", closerIds)
    .not("stage", "in", "(won,lost)");

  const loadByRep = new Map(closerIds.map((id) => [id, 0]));
  for (const o of openOpps ?? []) {
    if (o.owner_rep_id) loadByRep.set(o.owner_rep_id, (loadByRep.get(o.owner_rep_id) ?? 0) + 1);
  }
  return [...loadByRep.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

// §11.2 — a booking creates the opportunity; first_booked_at anchors it as
// one opportunity even if follow-up calls attach later. Ownership goes to
// whichever active closer takes the call — simple round-robin by current
// open-opportunity count, not AI matching (out of scope for now).
export async function createOpportunity(formData: FormData) {
  const client_id = String(formData.get("client_id"));
  const prospect_name = String(formData.get("prospect_name") ?? "").trim();
  const prospect_contact = String(formData.get("prospect_contact") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;
  const scheduled_at = String(formData.get("scheduled_at") ?? "");

  if (!client_id) throw new Error("A client must be selected — create a client first");
  if (!prospect_name || !scheduled_at) throw new Error("Prospect name and call time are required");

  const supabase = await createClient();

  const owner_rep_id = await pickRoundRobinCloser(supabase, client_id);

  const { data: opp, error } = await supabase
    .from("opportunities")
    .insert({ client_id, prospect_name, prospect_contact, source, stage: "booked", owner_rep_id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (!owner_rep_id) {
    await supabase.from("action_items").insert({
      title: `No closer available for ${prospect_name}`,
      reason: "This booking has no active closer assigned to the client to route to. Assign a closer manually.",
      client_id,
      opportunity_id: opp.id,
    });
  }

  await supabase.from("calls").insert({
    opportunity_id: opp.id,
    scheduled_at: new Date(scheduled_at).toISOString(),
  });

  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/opportunities");
  redirect(`/opportunities/${opp.id}`);
}

// §12 — mandatory call record: outcome + notes + next action + value + payment claim.
// Media (recording/transcript) is tracked separately and never blocks logging the rest.
export async function logCallOutcome(formData: FormData) {
  const callId = String(formData.get("call_id"));
  const opportunityId = String(formData.get("opportunity_id"));
  const outcome = String(formData.get("outcome")) as CallOutcome;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const agreed_next_action = String(formData.get("agreed_next_action") ?? "").trim() || null;
  const next_call_at = String(formData.get("next_call_at") ?? "");
  const deal_value = formData.get("deal_value") ? Number(formData.get("deal_value")) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("calls")
    .update({
      outcome,
      notes,
      agreed_next_action,
      next_call_at: next_call_at ? new Date(next_call_at).toISOString() : null,
      deal_value,
      logged_by: user?.id,
      logged_at: new Date().toISOString(),
    })
    .eq("id", callId);

  const stage = outcome === "completed_won" ? "won" : outcome === "completed_lost" ? "lost" : "follow_up";
  await supabase.from("opportunities").update({ stage, value: deal_value ?? undefined }).eq("id", opportunityId);

  // §12 — a nonterminal opportunity needs an owner and a concrete next action/date.
  if (stage === "follow_up" && !agreed_next_action) {
    const { data: opp } = await supabase.from("opportunities").select("prospect_name").eq("id", opportunityId).single();
    await supabase.from("action_items").insert({
      title: `Missing follow-up plan: ${opp?.prospect_name ?? "opportunity"}`,
      reason: "Call logged without a concrete agreed next action or next-call date.",
      opportunity_id: opportunityId,
    });
  }

  if (stage === "won" && deal_value) {
    const { data: deal } = await supabase
      .from("deals")
      .insert({ opportunity_id: opportunityId, value: deal_value, status: "won" })
      .select("id")
      .single();
    if (deal) {
      await supabase.from("action_items").insert({
        title: `Collect payment terms for won deal`,
        reason: "Deal marked won. RR/rep commission terms are not configured yet — this blocks final calculation per §15.2.",
        opportunity_id: opportunityId,
        money_impact: deal_value,
      });
    }
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/");
}

// §12 — manual fallback for recording/transcript when no capture provider is
// connected: attach a link/reference by hand rather than leaving media
// permanently "unavailable" with no way to resolve it.
export async function attachCallMedia(formData: FormData) {
  const callId = String(formData.get("call_id"));
  const opportunityId = String(formData.get("opportunity_id"));
  const recording_url = String(formData.get("recording_url") ?? "").trim();
  const transcript_url = String(formData.get("transcript_url") ?? "").trim();

  const supabase = await createClient();
  const patch: Database["public"]["Tables"]["calls"]["Update"] = {};
  if (recording_url) {
    patch.recording_url = recording_url;
    patch.recording_status = "available";
  }
  if (transcript_url) {
    patch.transcript_url = transcript_url;
    patch.transcript_status = "available";
  }
  if (Object.keys(patch).length === 0) return;

  await supabase.from("calls").update(patch).eq("id", callId);
  revalidatePath(`/opportunities/${opportunityId}`);
}
