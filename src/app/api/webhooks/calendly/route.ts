import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

// https://developer.calendly.com/api-docs/6c8f8b6c8b1b9-verifying-webhook-signatures
function verifyCalendlySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("Calendly-Webhook-Signature");
  const secret = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

  if (!secret || !verifyCalendlySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const body = JSON.parse(rawBody);
  const supabase = createServiceClient();
  const payload = body.payload;
  const contactEmail: string | undefined = payload?.email;
  const contactName: string | undefined = payload?.name;
  const startTime: string | undefined = payload?.scheduled_event?.start_time;

  if (!contactEmail) return new Response("ok", { status: 200 });

  const { data: existing } = await supabase
    .from("prospects")
    .select("id")
    .eq("contact_email", contactEmail)
    .is("converted_client_id", null)
    .maybeSingle();

  if (body.event === "invitee.created") {
    if (existing) {
      await supabase
        .from("prospects")
        .update({ stage: "call_booked", next_action: "Attend booked call", next_action_date: startTime })
        .eq("id", existing.id);
    } else {
      await supabase.from("prospects").insert({
        company_name: contactName ?? contactEmail,
        contact_name: contactName,
        contact_email: contactEmail,
        source: "calendly",
        stage: "call_booked",
        next_action: "Attend booked call",
        next_action_date: startTime,
      });
    }
  } else if (body.event === "invitee.canceled" && existing) {
    await supabase
      .from("prospects")
      .update({ stage: "no_show", next_action: "Re-engage — call was canceled", next_action_date: null })
      .eq("id", existing.id);
  }

  return new Response("ok", { status: 200 });
}
