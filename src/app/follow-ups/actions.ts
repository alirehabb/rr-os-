"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getFullThread, getLatestThreadState, replyToEmail } from "@/lib/instantly";
import { askAI } from "@/lib/ai";
import { runFollowUpForMembers, type FollowUpMember } from "@/lib/followupEngine";
import { revalidatePath } from "next/cache";

// runCampaignNow shares the same Instantly-rate-limit pacing as the cron
// route — same headroom needed.
export const maxDuration = 60;

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "sarah");
  if (!name) throw new Error("Campaign name is required");

  await supabase.from("campaigns").insert({ name, channel, created_by: user?.id, is_demo: false });
  revalidatePath("/follow-ups");
}

export async function addToCampaign(prospectId: string, campaignId: string) {
  const supabase = await createClient();
  await supabase.from("campaign_prospects").upsert({ prospect_id: prospectId, campaign_id: campaignId, status: "active" }, { onConflict: "campaign_id,prospect_id" });
  revalidatePath("/follow-ups");
}

export async function removeFromCampaign(campaignProspectId: string) {
  const supabase = await createClient();
  await supabase.from("campaign_prospects").delete().eq("id", campaignProspectId);
  revalidatePath("/follow-ups");
}

export async function getThreadForProspect(prospectId: string) {
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).single();
  if (!prospect) return { prospect: null, messages: [] };

  const messages = prospect.source === "instantly" && prospect.contact_email ? await getFullThread(prospect.contact_email) : [];
  return { prospect, messages };
}

// One-off, manual trigger — "the button" per the founder's request, distinct
// from a recurring campaign. Always drafts for review first; nothing sends
// until sendFollowUpNow is called explicitly with the (possibly edited) copy.
export async function draftFollowUpNow(prospectId: string): Promise<{ subject: string; body: string; suggestedChannel: "instantly" | "sarah" } | null> {
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).single();
  if (!prospect) return null;

  const { data: config } = await supabase.from("ai_agent_config").select("*").limit(1).single();
  const isInstantly = prospect.source === "instantly";
  const threadState = isInstantly && prospect.contact_email ? await getLatestThreadState(prospect.contact_email) : null;

  const draft = await askAI(
    `Write a short, natural follow-up email to a prospect.
Company: ${prospect.company_name}
Contact: ${prospect.contact_name ?? "unknown, use a generic greeting, no placeholders"}
Stage: ${prospect.stage}
Notes on file: ${prospect.qualification_notes ?? "none"}
Source: ${prospect.source ?? "unknown"}

It should read like a real person continuing an existing relationship, not a cold intro. It must end with a smooth, low-pressure nudge toward booking a call, not just a question left hanging, use the real booking link if one is configured, otherwise ask when a quick 15 minutes would work for them. Output just the email body, no subject line, no signature beyond a first-name sign-off.`,
    {
      system: `Tone: ${config?.tone ?? "professional, direct, human, 2-6 sentences"}.\n\nGUIDELINES:\n${config?.guidelines ?? "none set"}\n\nKNOWLEDGE BASE:\n${config?.knowledge_base ?? "none set"}\n\nBOOKING LINK: ${config?.booking_link ?? "none"}\nNever use bracket placeholders. No em dashes. No AI-sounding language.\n\nDo not proactively bring up acquisition/lead-gen unless asked.`,
      maxTokens: 300,
    },
  );
  if (!draft) return null;

  return {
    subject: threadState?.subject ? (threadState.subject.startsWith("Re:") ? threadState.subject : `Re: ${threadState.subject}`) : `Re: ${prospect.company_name}`,
    body: draft,
    suggestedChannel: isInstantly && threadState ? "instantly" : "sarah",
  };
}

export async function sendFollowUpNow(prospectId: string, channel: "instantly" | "sarah", subject: string, body: string) {
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("contact_email").eq("id", prospectId).single();
  if (!prospect?.contact_email) throw new Error("Prospect has no email on file");

  const html = body
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  if (channel === "instantly") {
    const state = await getLatestThreadState(prospect.contact_email);
    if (!state) throw new Error("No Instantly thread found for this prospect");
    const ok = await replyToEmail({ eaccount: state.eaccount, replyToUuid: state.lastMessageId, subject, html });
    if (!ok) throw new Error("Instantly reply failed to send");
  } else {
    const ok = await sendEmail({ to: prospect.contact_email, subject, html });
    if (!ok) throw new Error("Resend failed to send the email");
  }

  await supabase.from("prospects").update({ last_ai_followup_at: new Date().toISOString() }).eq("id", prospectId);
  revalidatePath("/follow-ups");
}

// Held-over from the CRM-sweep version: a followup_drafts row created by
// the campaign automation, reviewed and sent here the same way.
export async function sendCampaignDraft(draftId: string, editedSubject: string, editedBody: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: draft } = await supabase.from("followup_drafts").select("*, prospects(contact_email)").eq("id", draftId).single();
  if (!draft || draft.status !== "pending_review") throw new Error("Draft is no longer pending review");
  const to = draft.prospects?.contact_email;
  if (!to) throw new Error("Prospect has no email on file");

  const html = editedBody
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const ok = await sendEmail({ to, subject: editedSubject, html });
  if (!ok) throw new Error("Resend failed to send the email");

  await supabase
    .from("followup_drafts")
    .update({ status: "sent", subject: editedSubject, body: editedBody, sent_at: new Date().toISOString(), sent_by: user?.id })
    .eq("id", draftId);
  revalidatePath("/follow-ups");
}

export async function dismissCampaignDraft(draftId: string) {
  const supabase = await createClient();
  await supabase.from("followup_drafts").update({ status: "dismissed" }).eq("id", draftId);
  revalidatePath("/follow-ups");
}

// "See it happening in real time" without waiting for the hourly cron —
// runs the exact same engine, scoped to just this campaign's active
// members, so testing/checking a campaign never has to wait an hour.
export async function runCampaignNow(campaignId: string) {
  const supabase = await createClient();
  const { data: config } = await supabase.from("ai_agent_config").select("*").limit(1).single();
  if (!config?.auto_reply_enabled) throw new Error("Auto-reply is off in Settings > AI Reply Agent");

  const { data: members } = await supabase
    .from("campaign_prospects")
    .select("id, campaign_id, campaigns(channel, name), prospects(id, contact_email, contact_name, company_name, stage, source, timezone, qualification_notes, last_ai_followup_at)")
    .eq("campaign_id", campaignId)
    .eq("status", "active");

  const result = await runFollowUpForMembers(supabase, config, (members ?? []) as FollowUpMember[]);
  revalidatePath(`/follow-ups/campaigns/${campaignId}`);
  revalidatePath("/follow-ups");
  return { checked: (members ?? []).length, ...result };
}
