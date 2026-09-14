import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCollectionCore } from "@/lib/collections";

// Verifies Stripe's webhook signature by hand (HMAC-SHA256 over
// "<timestamp>.<rawBody>") so we don't need the stripe SDK for one check.
// https://docs.stripe.com/webhooks#verify-manually
function verifyStripeSignature(rawBody: string, header: string | null, secret: string): boolean {
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
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !verifyStripeSignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createServiceClient();

  // A real Stripe Invoice (created from Finance -> Send invoice) being paid
  // is itself sufficient verification evidence, same as a Checkout session —
  // it feeds the exact same collection -> ledger -> rep-payable pipeline.
  if (event.type === "invoice.paid") {
    const obj = event.data.object;
    const invoiceId: string | undefined = obj.metadata?.invoice_id;
    if (invoiceId) {
      const { data: invoice } = await supabase.from("invoices").select("id, client_id, deal_id, amount, status").eq("id", invoiceId).maybeSingle();
      if (invoice && invoice.status !== "paid") {
        await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoiceId);

        if (invoice.deal_id) {
          const { data: existing } = await supabase
            .from("collections")
            .select("id, status")
            .eq("external_reference", obj.id)
            .maybeSingle();
          let collectionId = existing?.id;
          if (!collectionId) {
            const { data: created } = await supabase
              .from("collections")
              .insert({ deal_id: invoice.deal_id, amount: invoice.amount, external_reference: obj.id, status: "reported" })
              .select("id")
              .single();
            collectionId = created?.id;
          }
          if (collectionId && existing?.status !== "verified") {
            await verifyCollectionCore(supabase, { collectionId, dealId: invoice.deal_id });
          }
        }

        await supabase.from("action_items").insert({
          title: `Invoice paid: $${Number(invoice.amount).toLocaleString()}`,
          reason: "A Stripe invoice sent from Finance was just paid. Verify the linked collection and any rep payable it created.",
          client_id: invoice.client_id,
          money_impact: invoice.amount,
        });
      }
    }
    return new Response("ok", { status: 200 });
  }

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const obj = event.data.object;
    const dealId: string | undefined = obj.metadata?.deal_id;
    const amount = (obj.amount_total ?? obj.amount ?? obj.amount_received ?? 0) / 100;
    const externalReference: string = obj.id;

    if (!dealId) {
      // No deal linked in Stripe metadata — flag for manual reconciliation
      // rather than guessing which deal/client this payment belongs to.
      await supabase.from("action_items").insert({
        title: "Unmatched Stripe payment needs reconciliation",
        reason: `Stripe payment ${externalReference} for $${amount} has no deal_id in its metadata. Set metadata.deal_id on the Payment Link/invoice so future payments auto-match.`,
        money_impact: amount,
      });
      return new Response("ok", { status: 200 });
    }

    const { data: existing } = await supabase
      .from("collections")
      .select("id, status")
      .eq("external_reference", externalReference)
      .maybeSingle();
    if (existing?.status === "verified") return new Response("ok", { status: 200 });

    let collectionId = existing?.id;
    if (!collectionId) {
      const { data: created } = await supabase
        .from("collections")
        .insert({ deal_id: dealId, amount, external_reference: externalReference, status: "reported" })
        .select("id")
        .single();
      collectionId = created?.id;
    }
    if (!collectionId) return new Response("ok", { status: 200 });

    await verifyCollectionCore(supabase, { collectionId, dealId });
  }

  return new Response("ok", { status: 200 });
}
