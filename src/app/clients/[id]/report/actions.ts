"use server";

import { createClient } from "@/lib/supabase/server";
import { buildClientReportSnapshot } from "@/lib/clientReport";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// §17.3 — generate and store a report snapshot for a fixed period. This only
// ever reads client-scoped operational records; it cannot see communications
// marked internal or any Founder OS data (those tables aren't queried here).
export async function generateReport(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const days = Number(formData.get("period_days") ?? 7);

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const snapshot = await buildClientReportSnapshot(supabase, clientId, periodStart, periodEnd);

  const { data: report, error } = await supabase
    .from("client_reports")
    .insert({
      client_id: clientId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      snapshot,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${clientId}/report`);
  redirect(`/clients/${clientId}/report?report_id=${report.id}`);
}

// §17.1/§17.3 — Resend delivers the report. This is a real send: it always
// requires a recipient typed into this form by a human before anything goes
// out, and is never triggered automatically by generation above.
export async function sendReport(formData: FormData) {
  const reportId = String(formData.get("report_id"));
  const clientId = String(formData.get("client_id"));
  const recipientEmails = String(formData.get("recipient_emails") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipientEmails.length === 0) throw new Error("At least one recipient email is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: report } = await supabase.from("client_reports").select("snapshot").eq("id", reportId).single();
  const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).single();
  if (!report || !client) throw new Error("Report or client not found");

  const snapshot = report.snapshot as Record<string, unknown>;
  const html = renderReportHtml(client.name, snapshot);

  let delivery_status: "sent" | "failed" = "sent";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rehab Revenue OS <reports@rehab-revenue.com>",
        to: recipientEmails,
        subject: `${client.name} weekly report`,
        html,
      }),
    });
    if (!res.ok) delivery_status = "failed";
  } catch {
    delivery_status = "failed";
  }

  await supabase
    .from("client_reports")
    .update({
      delivery_status,
      recipient_emails: recipientEmails,
      sent_at: new Date().toISOString(),
      sent_by: user?.id,
    })
    .eq("id", reportId);

  revalidatePath(`/clients/${clientId}/report`);
}

function renderReportHtml(clientName: string, s: Record<string, unknown>): string {
  return `
    <h2>${clientName} Weekly Report</h2>
    <p>Period: ${new Date(s.periodStart as string).toLocaleDateString()} – ${new Date(s.periodEnd as string).toLocaleDateString()}</p>
    <ul>
      <li>Booked calls: ${s.bookedCalls}</li>
      <li>Attended: ${s.attended} · No-show: ${s.noShow} · Cancelled: ${s.cancelled}</li>
      <li>New opportunities: ${s.newOpportunities}</li>
      <li>Active pipeline value: $${s.activePipelineValue}</li>
      <li>Deals won: ${s.dealsWon} ($${s.dealsWonValue})</li>
      <li>Collections reported: $${s.reportedCollections} · verified: $${s.verifiedCollections}</li>
    </ul>
    <h3>Actions RR Is Taking</h3>
    <ul>${((s.actionsRRIsTaking as { title: string }[]) ?? []).map((a) => `<li>${a.title}</li>`).join("") || "<li>None outstanding</li>"}</ul>
    <h3>Required from Client</h3>
    <ul>${((s.requiredFromClient as { label: string }[]) ?? []).map((r) => `<li>${r.label}</li>`).join("") || "<li>Nothing outstanding</li>"}</ul>
  `;
}
