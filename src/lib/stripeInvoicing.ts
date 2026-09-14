import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Thin fetch-based wrapper around the real Stripe Invoicing API — same
// "no SDK needed for a few calls" style as the webhook signature checks.
// https://docs.stripe.com/api/invoices
const STRIPE_API = "https://api.stripe.com/v1";

function form(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripeRequest(path: string, params?: Record<string, string | number | undefined>) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? form(params) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe request to ${path} failed`);
  return json;
}

async function ensureStripeCustomer(
  supabase: SupabaseClient<Database>,
  client: { id: string; name: string; stripe_customer_id: string | null; billing_email: string },
): Promise<string> {
  if (client.stripe_customer_id) return client.stripe_customer_id;

  const customer = await stripeRequest("/customers", {
    name: client.name,
    email: client.billing_email,
    "metadata[client_id]": client.id,
  });
  await supabase.from("clients").update({ stripe_customer_id: customer.id }).eq("id", client.id);
  return customer.id;
}

// Creates a real Stripe invoice (draft -> invoice item -> finalize) and
// returns the hosted payment page URL. Does not email through Stripe — RR OS
// sends its own branded email so the client relationship stays in one place.
export async function createAndFinalizeStripeInvoice(
  supabase: SupabaseClient<Database>,
  {
    invoiceId,
    client,
    description,
    amount,
    dueDate,
  }: {
    invoiceId: string;
    client: { id: string; name: string; stripe_customer_id: string | null; billing_email: string };
    description: string;
    amount: number;
    dueDate: Date | null;
  },
): Promise<{ stripeInvoiceId: string; hostedInvoiceUrl: string }> {
  const customerId = await ensureStripeCustomer(supabase, client);

  const daysUntilDue = dueDate ? Math.max(1, Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 30;

  const invoice = await stripeRequest("/invoices", {
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    "metadata[invoice_id]": invoiceId,
  });

  await stripeRequest("/invoiceitems", {
    customer: customerId,
    invoice: invoice.id,
    amount: Math.round(amount * 100),
    currency: "usd",
    description,
  });

  const finalized = await stripeRequest(`/invoices/${invoice.id}/finalize`);

  return { stripeInvoiceId: finalized.id, hostedInvoiceUrl: finalized.hosted_invoice_url };
}

export async function voidStripeInvoice(stripeInvoiceId: string) {
  await stripeRequest(`/invoices/${stripeInvoiceId}/void`);
}
