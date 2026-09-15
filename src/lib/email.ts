// Thin Resend wrapper, same fetch-based approach as repEmails.ts — no
// SDK needed for a single POST. Used by the Inbox follow-up sender and the
// (currently OFF-by-default) AI auto-reply pipeline.
export async function sendEmail({ to, subject, html, from }: { to: string; subject: string; html: string; from?: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from ?? "Sarah at Rehab Revenue <sarah@team.rehab-revenue.com>", to: [to], subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
