import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";

// hiring.rehab-revenue.com has inbound email receiving enabled in Resend,
// but until this route + webhook existed, nothing was subscribed to
// "email.received" — every application sent there was accepted by Resend's
// infra and then dropped on the floor, never reaching this app. This route
// turns that into a real application row.

// Resend signs webhooks the Svix way: HMAC-SHA256 over
// "{svix-id}.{svix-timestamp}.{body}" using the base64 part of the
// "whsec_..." secret, compared against one of the space-separated
// "v1,<sig>" values in svix-signature.
function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${rawBody}`).digest("base64");

  return signatureHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

function parseFrom(from: unknown): { name: string | null; email: string | null } {
  if (typeof from === "object" && from && "email" in from) {
    const f = from as { name?: string; email?: string };
    return { name: f.name ?? null, email: f.email ?? null };
  }
  const str = String(from ?? "");
  const match = str.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || null, email: match[2].trim() };
  return { name: null, email: str.trim() || null };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !verifySignature(rawBody, req.headers, secret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createServiceClient();

  // Every inbound event is logged regardless of what we do with it, so a
  // payload-shape surprise is debuggable instead of just silently missed
  // again the same way the missing webhook was.
  await supabase.from("audit_log").insert({
    actor_type: "automation",
    action: "resend_inbound_email",
    target_type: "email",
    target_id: null,
    after: { type: event?.type, data: event?.data },
  });

  if (event?.type !== "email.received") return new Response("ok", { status: 200 });

  const data = event.data ?? {};
  const { name, email } = parseFrom(data.from);
  if (!email) return new Response("ok", { status: 200 });

  const bodyText = String(data.text ?? data.html ?? "").slice(0, 4000);
  const { data: existing } = await supabase.from("reps").select("id, full_name, notes").eq("email", email).maybeSingle();

  if (existing) {
    // A reply from someone already in the pipeline (interview confirmation,
    // a resume/recording follow-up, an update on their status). Land it on
    // their card as a timestamped note rather than dropping it — the
    // founder decides the actual status change, this just makes sure they
    // see it happened.
    const stamped = `[${new Date().toLocaleString()}] Replied: ${bodyText}`;
    await supabase
      .from("reps")
      .update({ notes: existing.notes ? `${existing.notes}\n\n${stamped}` : stamped })
      .eq("id", existing.id);

    await sendEmail({
      to: "ali@rehab-revenue.com",
      subject: `${existing.full_name} replied`,
      html: `<p><strong>${existing.full_name}</strong> (${email}) replied to a talent email.</p>
<blockquote style="border-left:3px solid #ccc;margin:0;padding-left:12px;color:#444">${bodyText.replace(/\n/g, "<br/>")}</blockquote>
<p>Added to their notes on the Talent card.</p>`,
    });
    return new Response("ok", { status: 200 });
  }

  await supabase.from("reps").insert({
    full_name: name || email,
    email,
    capabilities: [],
    evidence_source: `Inbound application email (${data.subject ?? "no subject"})`,
    notes: bodyText || null,
  });

  await sendEmail({
    to: "ali@rehab-revenue.com",
    subject: `New application: ${name || email}`,
    html: `<p>New talent application from <strong>${name || email}</strong> (${email}).</p>
<blockquote style="border-left:3px solid #ccc;margin:0;padding-left:12px;color:#444">${bodyText.replace(/\n/g, "<br/>")}</blockquote>`,
  });

  return new Response("ok", { status: 200 });
}
