"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { HANDOVER_CHECKLIST } from "@/lib/clientOnboarding";

// Demo Data Mode: seeds a coherent fictional scenario, every row flagged
// is_demo=true so it can never be mistaken for real activity and can be
// purged completely in one action. Aggregate/finance queries exclude
// is_demo rows; list/detail views show them tagged "Demo".
export async function enableDemoMode() {
  const supabase = await createClient();

  const { data: config } = await supabase.from("demo_mode").select("id").limit(1).single();
  if (!config) return;

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString();
  const daysFromNow = (n: number) => new Date(now + n * 86400000).toISOString();

  const clientsSeed = [
    { name: "Azgari", workflow_type: "azgari", lifecycle_state: "active" as const, signed_at: daysAgo(90), rr_rate: 0.1 },
    { name: "Drivia", workflow_type: "closing_only", lifecycle_state: "active" as const, signed_at: daysAgo(60), rr_rate: 0.15 },
    { name: "Apex Solutions", workflow_type: "closing_only", lifecycle_state: "fulfillment" as const, signed_at: daysAgo(3), rr_rate: null },
    { name: "OptiWisdom", workflow_type: "setting_enabled", lifecycle_state: "onboarding" as const, signed_at: daysAgo(1), rr_rate: null },
    { name: "OpenPro", workflow_type: "closing_only", lifecycle_state: "paused" as const, signed_at: daysAgo(180), rr_rate: 0.12 },
  ];

  const clientIds: Record<string, string> = {};
  for (const c of clientsSeed) {
    const { data: client } = await supabase
      .from("clients")
      .insert({
        name: c.name,
        workflow_type: c.workflow_type,
        lifecycle_state: c.lifecycle_state,
        signed_at: c.signed_at,
        rr_rate_basis: c.rr_rate ? { type: "cash_percentage", rr_rate: c.rr_rate } : null,
        fulfillment_completed_at: c.lifecycle_state === "active" || c.lifecycle_state === "paused" ? daysAgo(80) : null,
        go_live_completed_at: c.lifecycle_state === "active" || c.lifecycle_state === "paused" ? daysAgo(75) : null,
        is_demo: true,
      })
      .select("id")
      .single();
    if (client) clientIds[c.name] = client.id;
  }

  // §8.2 Complete Sales Handover checklist — verified for established
  // clients, a realistic mix of submitted/missing for newer ones, so the
  // Client 360 handover section and fulfillment blockers aren't empty.
  for (const c of clientsSeed) {
    const clientId = clientIds[c.name];
    if (!clientId) continue;
    const established = c.lifecycle_state === "active" || c.lifecycle_state === "paused";
    await supabase.from("handover_items").insert(
      HANDOVER_CHECKLIST.map((item, i) => ({
        client_id: clientId,
        category: item.category,
        label: item.label,
        status: established ? "verified" : i < 3 ? "submitted" : "missing",
        reviewed_at: established ? daysAgo(70) : null,
        is_demo: true,
      })),
    );
  }

  const repsSeed = [
    { name: "Marcus Chen", email: "demo-marcus@example.invalid", capabilities: ["closer"] },
    { name: "Sarah Ibrahim", email: "demo-sarah@example.invalid", capabilities: ["closer"] },
    { name: "Dalia Reyes", email: "demo-dalia@example.invalid", capabilities: ["closer", "setter"] },
  ];
  const repIds: Record<string, string> = {};
  for (const r of repsSeed) {
    const { data: rep } = await supabase
      .from("reps")
      .insert({ full_name: r.name, email: r.email, capabilities: r.capabilities, recruiting_status: "confirmed_active", is_demo: true })
      .select("id")
      .single();
    if (rep) repIds[r.name] = rep.id;
  }

  // Compensation terms are required for the wallet flow to compute anything —
  // without these, verifying a collection would (correctly) just flag missing
  // terms instead of paying a rep, which is real behavior but not useful demo.
  const assignmentIds: Record<string, string> = {};
  const assignmentsSeed = [
    { rep: "Marcus Chen", client: "Azgari", rate: 0.5, basis: "rr_share" as const, activeFrom: daysAgo(80) },
    { rep: "Sarah Ibrahim", client: "Drivia", rate: 0.4, basis: "rr_share" as const, activeFrom: daysAgo(55) },
    { rep: "Dalia Reyes", client: "Apex Solutions", rate: null, basis: null, activeFrom: null },
  ];
  for (const a of assignmentsSeed) {
    const { data: assignment } = await supabase
      .from("rep_assignments")
      .insert({
        rep_id: repIds[a.rep],
        client_id: clientIds[a.client],
        role: "closer",
        status: a.activeFrom ? "active" : "training",
        active_from: a.activeFrom,
        compensation_terms: a.rate ? { type: "percentage", rate: a.rate, basis: a.basis } : null,
      })
      .select("id")
      .single();
    if (assignment) assignmentIds[`${a.rep}-${a.client}`] = assignment.id;
  }

  const oppsSeed = [
    { client: "Azgari", prospect: "Broker Intro — Coastal Partners", stage: "won" as const, value: 18000, ownerRep: "Marcus Chen", daysBack: 12 },
    { client: "Azgari", prospect: "Candidate Review — J. Whitfield", stage: "follow_up" as const, value: 9000, ownerRep: "Marcus Chen", daysBack: 2 },
    { client: "Drivia", prospect: "Proposal Follow-up — Nexa Corp", stage: "follow_up" as const, value: 12000, ownerRep: "Sarah Ibrahim", daysBack: 1 },
    { client: "Drivia", prospect: "Discovery — Fielding Co", stage: "won" as const, value: 24000, ownerRep: "Sarah Ibrahim", daysBack: 20 },
    { client: "Apex Solutions", prospect: "Apex Discovery Call", stage: "booked" as const, value: null, ownerRep: "Dalia Reyes", daysBack: 0 },
    { client: "OpenPro", prospect: "Liv180 Deal — Payment Pending", stage: "won" as const, value: 15000, ownerRep: "Marcus Chen", daysBack: 30 },
  ];

  for (const o of oppsSeed) {
    const { data: opp } = await supabase
      .from("opportunities")
      .insert({
        client_id: clientIds[o.client],
        prospect_name: o.prospect,
        stage: o.stage,
        value: o.value,
        owner_rep_id: repIds[o.ownerRep],
        first_booked_at: daysAgo(o.daysBack + 1),
        is_demo: true,
      })
      .select("id")
      .single();
    if (!opp) continue;

    const outcome = o.stage === "won" ? "completed_won" : o.stage === "follow_up" ? "completed_follow_up" : "pending";
    await supabase.from("calls").insert({
      opportunity_id: opp.id,
      scheduled_at: daysAgo(o.daysBack),
      outcome,
      logged_at: outcome !== "pending" ? daysAgo(o.daysBack) : null,
      agreed_next_action: outcome === "completed_follow_up" ? "Send updated proposal" : null,
      deal_value: o.stage === "won" ? o.value : null,
      is_demo: true,
    });

    if (o.stage === "won" && o.value) {
      const { data: deal } = await supabase
        .from("deals")
        .insert({ opportunity_id: opp.id, value: o.value, status: "won", is_demo: true })
        .select("id")
        .single();
      if (!deal) continue;

      const verified = o.client !== "OpenPro"; // OpenPro stays "reported" to demo the unverified-claim state
      const { data: collection } = await supabase
        .from("collections")
        .insert({
          deal_id: deal.id,
          amount: o.value,
          status: verified ? "verified" : "reported",
          reported_at: daysAgo(o.daysBack - 1),
          verified_at: verified ? daysAgo(o.daysBack - 1) : null,
          is_demo: true,
        })
        .select("id")
        .single();
      if (!collection || !verified) continue;

      // Mirror finance/actions.ts's verifyCollection math so demo numbers
      // reconcile the same way real ones would.
      const client = clientsSeed.find((c) => c.name === o.client);
      const rrRate = client?.rr_rate ?? null;
      if (!rrRate) continue;
      const rrAmount = o.value * rrRate;

      const { data: ledgerRR } = await supabase
        .from("ledger_entries")
        .insert({
          collection_id: collection.id,
          client_id: clientIds[o.client],
          entry_type: "rr_receivable",
          amount: rrAmount,
          effective_terms: { type: "cash_percentage", rr_rate: rrRate },
          is_demo: true,
        })
        .select("id")
        .single();

      const assignmentKey = `${o.ownerRep}-${o.client}`;
      const assignment = assignmentsSeed.find((a) => `${a.rep}-${a.client}` === assignmentKey);
      if (assignment?.rate && ledgerRR) {
        const repAmount = rrAmount * assignment.rate;
        const { data: ledgerRep } = await supabase
          .from("ledger_entries")
          .insert({
            collection_id: collection.id,
            client_id: clientIds[o.client],
            entry_type: "rep_commission_earned",
            amount: repAmount,
            rep_id: repIds[o.ownerRep],
            effective_terms: { type: "percentage", rate: assignment.rate, basis: assignment.basis },
            is_demo: true,
          })
          .select("id")
          .single();

        await supabase.from("wallet_entries").insert({
          rep_id: repIds[o.ownerRep],
          ledger_entry_id: ledgerRep?.id,
          amount: repAmount,
          status: "pending_client_payment",
          is_demo: true,
        });
      }
    }
  }

  await supabase.from("action_items").insert([
    {
      title: "Review Azgari call notes and approve next steps",
      reason: "Won deal logged 12 days ago — confirm follow-up plan with the client.",
      client_id: clientIds["Azgari"],
      deadline_at: daysFromNow(0),
      money_impact: 18000,
      is_demo: true,
    },
    {
      title: "Approve contract for Apex Solutions",
      reason: "Executed handover pending founder sign-off before fulfillment can complete.",
      client_id: clientIds["Apex Solutions"],
      deadline_at: daysFromNow(1),
      money_impact: null,
      is_demo: true,
    },
    {
      title: "Assign new setter to OptiWisdom",
      reason: "Setting-enabled client onboarded yesterday with no setter assigned yet.",
      client_id: clientIds["OptiWisdom"],
      deadline_at: daysFromNow(1),
      money_impact: null,
      is_demo: true,
    },
    {
      title: "Check payment status for Liv180 deal",
      reason: "Collection reported 30 days ago still shows unverified.",
      client_id: clientIds["OpenPro"],
      deadline_at: daysFromNow(1),
      money_impact: 15000,
      is_demo: true,
    },
  ]);

  await supabase.from("prospects").insert([
    { company_name: "Meridian Health Group", source: "website", stage: "call_booked", is_demo: true },
    { company_name: "Northgate Wellness", source: "instantly", stage: "interested", is_demo: true },
  ]);

  await supabase.from("demo_mode").update({ enabled: true, updated_at: new Date().toISOString() }).eq("id", config.id);

  revalidatePath("/", "layout");
}

export async function disableDemoMode() {
  const supabase = await createClient();

  // Purge in dependency order so foreign keys never block deletion.
  await supabase.from("wallet_entries").delete().eq("is_demo", true);
  await supabase.from("ledger_entries").delete().eq("is_demo", true);
  await supabase.from("collections").delete().eq("is_demo", true);
  await supabase.from("deals").delete().eq("is_demo", true);
  await supabase.from("calls").delete().eq("is_demo", true);
  await supabase.from("action_items").delete().eq("is_demo", true);
  await supabase.from("handover_items").delete().eq("is_demo", true);
  await supabase.from("rep_assignments").delete().in("client_id", (await supabase.from("clients").select("id").eq("is_demo", true)).data?.map((c) => c.id) ?? []);
  await supabase.from("opportunities").delete().eq("is_demo", true);
  await supabase.from("prospects").delete().eq("is_demo", true);
  await supabase.from("reps").delete().eq("is_demo", true);
  await supabase.from("clients").delete().eq("is_demo", true);

  const { data: config } = await supabase.from("demo_mode").select("id").limit(1).single();
  if (config) {
    await supabase.from("demo_mode").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", config.id);
  }

  revalidatePath("/", "layout");
}
