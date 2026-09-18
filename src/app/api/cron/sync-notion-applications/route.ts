import { createServiceClient } from "@/lib/supabase/service";
import { fetchNotionApplications } from "@/lib/notion";
import { sendEmail } from "@/lib/email";

// The real incident this fixes: an applicant (Harlem Queensborough) sat in
// the Notion "Closers/Setters Applications" database for 11+ days without
// ever being copied into the reps table, with nothing to flag that it had
// happened — Notion's own Status column only ever says "New", so a missed
// row looks identical to one that's just old. This runs hourly and closes
// that gap by diffing Notion against reps directly, no manual copy step.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { applications, error } = await fetchNotionApplications();
  if (error) return Response.json({ checked: 0, added: 0, error }, { status: 500 });
  if (applications.length === 0) return Response.json({ checked: 0, added: 0 });

  const supabase = createServiceClient();
  const added: string[] = [];

  for (const app of applications) {
    if (!app.email) continue;

    const { data: existing } = await supabase.from("reps").select("id").ilike("email", app.email).maybeSingle();
    if (existing) continue;

    await supabase.from("reps").insert({
      full_name: app.name,
      email: app.email,
      capabilities: app.role ? [app.role] : [],
      geography: app.location,
      phone: app.phone,
      linkedin_url: app.linkedin,
      resume_url: app.resume,
      intro_loom_url: app.loomIntro,
      sales_recording_url: app.salesRecording,
      offer_text: app.offer,
      evidence_source: "Notion application — Closers/Setters Applications",
    });
    added.push(app.name);
  }

  if (added.length > 0) {
    await sendEmail({
      to: "ali@rehab-revenue.com",
      subject: `${added.length} new application(s) synced from Notion`,
      html: `<p>Added to the Talent roster automatically:</p><ul>${added.map((n) => `<li>${n}</li>`).join("")}</ul>`,
    });
  }

  return Response.json({ checked: applications.length, added: added.length, names: added });
}
