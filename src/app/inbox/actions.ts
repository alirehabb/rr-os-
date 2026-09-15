"use server";

import { createClient } from "@/lib/supabase/server";
import { getRecentReplies } from "@/lib/instantly";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

export type InboxRow = {
  replyId: string;
  prospectId: string;
  companyGuess: string;
  contactEmail: string;
  contactName: string;
  subject: string;
  preview: string;
  receivedAt: string;
};

// Pulls real Instantly replies, matches each to an existing prospect by
// email (so a lead that already came through the pre-qual funnel or an
// earlier campaign never gets duplicated), creating a new prospect only
// when no match exists. The reply text lands in qualification_notes so
// draftFollowUpEmail() (prospects/actions.ts) can ground its draft in the
// actual conversation without any changes to that function.
export async function syncInstantlyInbox(): Promise<InboxRow[]> {
  const supabase = await createClient();
  const replies = await getRecentReplies(30);
  if (replies.length === 0) return [];

  const emails = replies.map((r) => r.leadEmail.toLowerCase());
  const { data: existing } = await supabase.from("prospects").select("id, contact_email, company_name, contact_name").in("contact_email", emails);
  const byEmail = new Map((existing ?? []).map((p) => [p.contact_email?.toLowerCase(), p]));

  const rows: InboxRow[] = [];
  for (const reply of replies) {
    const key = reply.leadEmail.toLowerCase();
    let prospect = byEmail.get(key);

    if (!prospect) {
      const companyGuess = reply.leadEmail.split("@")[1]?.split(".")[0] ?? reply.fromName;
      const { data: created } = await supabase
        .from("prospects")
        .insert({
          company_name: companyGuess,
          contact_name: reply.fromName,
          contact_email: reply.leadEmail,
          source: "instantly",
          stage: "interested",
          qualification_notes: `Instantly reply (${new Date(reply.receivedAt).toLocaleDateString()}): ${reply.preview}`,
          is_demo: false,
        })
        .select("id, contact_email, company_name, contact_name")
        .single();
      if (created) {
        prospect = created;
        byEmail.set(key, created);
      }
    } else {
      await supabase
        .from("prospects")
        .update({ qualification_notes: `Instantly reply (${new Date(reply.receivedAt).toLocaleDateString()}): ${reply.preview}` })
        .eq("id", prospect.id);
    }

    if (prospect) {
      rows.push({
        replyId: reply.id,
        prospectId: prospect.id,
        companyGuess: prospect.company_name,
        contactEmail: reply.leadEmail,
        contactName: prospect.contact_name ?? reply.fromName,
        subject: reply.subject,
        preview: reply.preview,
        receivedAt: reply.receivedAt,
      });
    }
  }

  return rows;
}

// Client-invoked wrapper: same sync, but safe to call revalidatePath from
// since it's a real server action call (not inline during a page render,
// where Next.js forbids it).
export async function syncInstantlyInboxAction(): Promise<InboxRow[]> {
  const rows = await syncInstantlyInbox();
  revalidatePath("/inbox");
  revalidatePath("/prospects");
  return rows;
}

export async function sendFollowUpEmail(prospectId: string, subject: string, body: string) {
  const supabase = await createClient();
  const { data: p } = await supabase.from("prospects").select("contact_email, contact_name").eq("id", prospectId).single();
  if (!p?.contact_email) throw new Error("Prospect has no email on file");

  const html = body
    .split("\n\n")
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const sent = await sendEmail({ to: p.contact_email, subject, html });
  if (!sent) throw new Error("Resend failed to send the email");

  await supabase.from("prospects").update({ next_action: null, next_action_date: null }).eq("id", prospectId);
  revalidatePath("/prospects");
  revalidatePath("/inbox");
}

// "Remind me to follow up" — a real Command Queue item, not a fire-and-forget
// toast, so it survives past this page load per the founder's own request
// for reminders alongside the manual-send button.
export async function remindFollowUp(prospectId: string, companyName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("action_items").insert({
    title: `Follow up with ${companyName}`,
    reason: "Interested Instantly reply awaiting a response",
    status: "open",
    priority: 2,
    owner_id: user?.id,
    is_demo: false,
  });
  revalidatePath("/command-center");
  revalidatePath("/inbox");
}
