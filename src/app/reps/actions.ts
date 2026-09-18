"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { sendRecruitingStatusEmail, sendCustomRepEmail } from "@/lib/repEmails";
import { askAI } from "@/lib/ai";

type RecruitingStatus = Database["public"]["Enums"]["recruiting_status"];

// §10.1 — website/manual intake creates a persistent Rep 360 profile.
// §10.2 — job-relevant factors only: experience, cash collected, geography/timezone,
// communication, professionalism, coachability, availability. Never race/ethnicity.
export async function createRep(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const capabilities = formData.getAll("capabilities").map(String);
  const geography = String(formData.get("geography") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "").trim() || null;
  const evidence_source = String(formData.get("evidence_source") ?? "").trim() || null;
  const claimed = formData.get("claimed_cash_collected");

  if (!full_name || !email) throw new Error("Name and email are required");

  const supabase = await createClient();
  const { data: rep, error } = await supabase
    .from("reps")
    .insert({
      full_name,
      email,
      capabilities,
      geography,
      timezone,
      evidence_source,
      claimed_cash_collected: claimed ? Number(claimed) : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/reps");
  redirect(`/reps/${rep.id}`);
}

// §10.1 recruiting flow: Application → Screening → Interview/Pool/Rejected →
// Available for matching → Selected → Client training → Live trial → Confirmed/Bench/Removed.
// Human decides every transition — nothing here is automatic. Every transition
// does send the matching applicant email (interview link, trial notice,
// rejection + community waitlist, etc.) via sendRecruitingStatusEmail.
export async function updateRecruitingStatus(formData: FormData) {
  const repId = String(formData.get("rep_id"));
  const recruiting_status = String(formData.get("recruiting_status")) as RecruitingStatus;
  const supabase = await createClient();
  await supabase.from("reps").update({ recruiting_status }).eq("id", repId);
  await sendRecruitingStatusEmail(supabase, { repId, status: recruiting_status });
  revalidatePath(`/reps/${repId}`);
  revalidatePath("/reps");
}

// §10.4 — assigning a rep to a client starts client-specific training; the
// 7-day live trial clock starts separately, at first live work (not here).
export async function assignRepToClient(formData: FormData) {
  const repId = String(formData.get("rep_id"));
  const clientId = String(formData.get("client_id"));
  const role = String(formData.get("role"));

  const supabase = await createClient();
  const { error } = await supabase.from("rep_assignments").insert({
    rep_id: repId,
    client_id: clientId,
    role,
    status: "training",
  });
  if (error) throw new Error(error.message);

  await supabase.from("reps").update({ recruiting_status: "client_training" }).eq("id", repId);

  revalidatePath(`/reps/${repId}`);
}

// Links a rep's Sales Talent profile to their platform login by email match,
// so RLS (rep_own_*) can scope /my to the right person. Founder-only (RLS).
export async function linkRepProfile(formData: FormData) {
  const repId = String(formData.get("rep_id"));
  const supabase = await createClient();

  const { data: rep } = await supabase.from("reps").select("email").eq("id", repId).single();
  if (!rep) throw new Error("Rep not found");

  const { data: profile } = await supabase.from("profiles").select("id").eq("email", rep.email).maybeSingle();
  if (!profile) {
    throw new Error("No platform account with this rep's email has signed in yet");
  }

  await supabase.from("reps").update({ profile_id: profile.id }).eq("id", repId);
  revalidatePath(`/reps/${repId}`);
}

// §8.3 — trial begins when the rep starts live work, not at signature or assignment.
export async function startLiveTrial(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id"));
  const repId = String(formData.get("rep_id"));
  const supabase = await createClient();
  await supabase
    .from("rep_assignments")
    .update({ status: "trial", trial_started_at: new Date().toISOString() })
    .eq("id", assignmentId);
  await supabase.from("reps").update({ recruiting_status: "live_trial" }).eq("id", repId);
  revalidatePath(`/reps/${repId}`);
}

// §10.4 — human evaluation at trial end: confirmed active, bench, or removed. Never automatic.
export async function reviewTrial(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id"));
  const repId = String(formData.get("rep_id"));
  const result = String(formData.get("trial_review_result"));
  const outcome = String(formData.get("outcome")); // active | bench | removed

  const supabase = await createClient();
  await supabase
    .from("rep_assignments")
    .update({
      trial_review_result: result,
      trial_reviewed_at: new Date().toISOString(),
      status: outcome,
      active_from: outcome === "active" ? new Date().toISOString() : null,
    })
    .eq("id", assignmentId);

  await supabase
    .from("reps")
    .update({ recruiting_status: outcome === "active" ? "confirmed_active" : outcome === "bench" ? "bench" : "removed" })
    .eq("id", repId);

  revalidatePath(`/reps/${repId}`);
}

// AI draft for the custom-email box: the founder types what they want said,
// this returns a subject/body pair for them to review and edit before
// sendCustomEmail ever fires — same draft-then-send discipline as the AI
// reply agent, just manually triggered here instead of automatic.
export async function draftCustomEmail(repId: string, prompt: string): Promise<{ subject: string; body: string } | null> {
  const supabase = await createClient();
  const { data: rep } = await supabase.from("reps").select("full_name").eq("id", repId).single();
  if (!rep) return null;

  const draft = await askAI(
    `Write the middle of a short, professional email to a sales rep/candidate named ${rep.full_name}.
What it needs to say: ${prompt}

The greeting ("Hi ${rep.full_name.split(" ")[0]},") and the sign-off ("Sarah / Rehab Revenue") are added automatically outside this text — do NOT write your own greeting or sign-off, just the body content in between. Output exactly two lines to start: "Subject: <subject line>" then a blank line, then only that body content. No placeholders.`,
    { system: "You are Sarah, writing on behalf of Rehab Revenue's talent team. Professional, direct, human. No em dashes, no AI-sounding language.", maxTokens: 300 },
  );
  if (!draft) return null;

  const match = draft.match(/^Subject:\s*(.+)\n+([\s\S]+)$/i);
  if (!match) return { subject: `Re: ${rep.full_name}`, body: draft.trim() };
  return { subject: match[1].trim(), body: match[2].trim() };
}

// Founder asking a rep for a document, more detail, or anything ad hoc,
// separate from the fixed recruiting-status templates above.
export async function sendCustomEmail(formData: FormData) {
  const repId = String(formData.get("rep_id"));
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) return;

  const supabase = await createClient();
  await sendCustomRepEmail(supabase, { repId, subject, body });
  revalidatePath(`/reps/${repId}`);
}

// Everything the founder needs for one rep, fetched in one shot when the
// Talent card's slide-over opens — avoids a full page navigation just to
// see trial/compensation/reconciliation history alongside the roster.
export async function getRepFullRecord(repId: string) {
  const supabase = await createClient();
  const [{ data: assignments }, { data: clients }, { data: reconciliations }] = await Promise.all([
    supabase.from("rep_assignments").select("*").eq("rep_id", repId).order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("audit_log").select("*").eq("action", "reconcile_missing_commission").order("created_at", { ascending: false }).limit(20),
  ]);

  return {
    assignments: assignments ?? [],
    clients: clients ?? [],
    reconciliations: (reconciliations ?? []).filter((r) => (r.after as { rep_id?: string } | null)?.rep_id === repId),
  };
}
