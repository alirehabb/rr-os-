import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const INTERVIEW_SCHEDULING_URL = "https://calendly.com/ali-rehabrevenues/rehab-revenue-interviews";
const FROM = "Sarah at Rehab Revenue <sarah@hiring.rehab-revenue.com>";

type RecruitingStatus = Database["public"]["Enums"]["recruiting_status"];

function wrap(name: string, body: string) {
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">
    <p>Hi ${name},</p>
    ${body}
    <p style="margin-top:24px">Sarah<br/>Rehab Revenue</p>
  </div>`;
}

const TEMPLATES: Partial<Record<RecruitingStatus, (name: string) => { subject: string; html: string }>> = {
  screening: (name) => ({
    subject: "We've received your application, Rehab Revenue",
    html: wrap(name, `<p>Thanks for applying to Rehab Revenue. We're reviewing your application now and will follow up shortly with next steps.</p>`),
  }),
  interview: (name) => ({
    subject: "You're invited to interview, Rehab Revenue",
    html: wrap(
      name,
      `<p>Good news. We'd like to move forward with an interview.</p>
       <p>Please book a time here: <a href="${INTERVIEW_SCHEDULING_URL}">${INTERVIEW_SCHEDULING_URL}</a></p>`,
    ),
  }),
  talent_pool: (name) => ({
    subject: "You're in our talent pool, Rehab Revenue",
    html: wrap(name, `<p>You've been added to our talent pool. We'll reach out as soon as a client matches your profile.</p>`),
  }),
  available_for_matching: (name) => ({
    subject: "You're ready to be matched, Rehab Revenue",
    html: wrap(name, `<p>You're now available for client matching. We'll be in touch as soon as we have a fit.</p>`),
  }),
  selected: (name) => ({
    subject: "You've been selected, Rehab Revenue",
    html: wrap(name, `<p>You've been selected for a client opportunity. We'll follow up shortly with details.</p>`),
  }),
  client_training: (name) => ({
    subject: "Client training is starting, Rehab Revenue",
    html: wrap(name, `<p>You've been matched with a client and training is starting. Keep an eye out for onboarding details.</p>`),
  }),
  live_trial: (name) => ({
    subject: "Your live trial has started, Rehab Revenue",
    html: wrap(name, `<p>Your 7-day live trial is now active. Bring your best, we'll review performance at the end of the trial.</p>`),
  }),
  confirmed_active: (name) => ({
    subject: "You're confirmed, welcome aboard!",
    html: wrap(name, `<p>Congratulations, you've been confirmed as an active rep. Welcome to the team!</p>`),
  }),
  bench: (name) => ({
    subject: "An update on your status, Rehab Revenue",
    html: wrap(
      name,
      `<p>You've been moved to our bench for now. This isn't a rejection, we'll reach out as soon as a fitting opportunity comes up.</p>`,
    ),
  }),
  rejected: (name) => ({
    subject: "An update on your application, Rehab Revenue",
    html: wrap(
      name,
      `<p>Thank you for taking the time to apply. We won't be moving forward right now, but we'd love for you to hold on.
       We're signing more clients regularly and could use your help down the line.</p>
       <p>We've added you to our free sales community waitlist, where you'll get real resources to help you sharpen your
       skills while you wait. We'll be in touch.</p>`,
    ),
  }),
  removed: (name) => ({
    subject: "An update on your status, Rehab Revenue",
    html: wrap(
      name,
      `<p>You've been removed from active rotation. Thank you for the work you put in, we may reach back out for future opportunities.</p>`,
    ),
  }),
};

// Every recruiting-status change sends the matching applicant/rep email.
// Interview requests carry the real Calendly link, rejection offers the
// community waitlist. Never blocks the status update: a Resend failure is
// recorded, not thrown, same as the client-report sender.
export async function sendRecruitingStatusEmail(
  supabase: SupabaseClient<Database>,
  { repId, status }: { repId: string; status: RecruitingStatus },
) {
  const template = TEMPLATES[status];
  if (!template) return;

  const { data: rep } = await supabase.from("reps").select("full_name, email").eq("id", repId).single();
  if (!rep?.email) return;

  const { subject, html } = template(rep.full_name);

  let delivery_status: "sent" | "failed" = "sent";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [rep.email], subject, html }),
    });
    if (!res.ok) delivery_status = "failed";
  } catch {
    delivery_status = "failed";
  }

  if (status === "rejected") {
    await supabase.from("reps").update({ community_waitlist: true }).eq("id", repId);
  }

  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "send_recruiting_email",
    target_type: "rep",
    target_id: repId,
    after: { status, to: rep.email, subject, delivery_status },
  });
}
