"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

export async function sendFollowUpDraft(draftId: string, editedSubject: string, editedBody: string) {
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

export async function dismissFollowUpDraft(draftId: string) {
  const supabase = await createClient();
  await supabase.from("followup_drafts").update({ status: "dismissed" }).eq("id", draftId);
  revalidatePath("/follow-ups");
}
