"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyCollectionCore, reconcileMissingCommissions } from "@/lib/collections";
import { createAndFinalizeStripeInvoice, voidStripeInvoice } from "@/lib/stripeInvoicing";

const INVOICE_FROM = "Rehab Revenue Finance <finance@hiring.rehab-revenue.com>";

async function sendInvoiceEmail(billingEmail: string, clientName: string, amount: number, dueDate: Date | null, hostedUrl: string) {
  const money = amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: INVOICE_FROM,
        to: [billingEmail],
        subject: `Invoice from Rehab Revenue: ${money}`,
        html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">
          <p>Hi ${clientName} team,</p>
          <p>Here's an invoice from Rehab Revenue for ${money}${dueDate ? `, due ${dueDate.toLocaleDateString()}` : ""}.</p>
          <p><a href="${hostedUrl}">${hostedUrl}</a></p>
          <p>Rehab Revenue</p>
        </div>`,
      }),
    });
  } catch {
    // best-effort — the invoice and hosted link are already real either way,
    // the founder can copy the link manually if the email send fails
  }
}

// §15 Finance Operations — a client owing RR money gets an actual invoice
// issued from RR OS: real Stripe invoice, real hosted payment page, sent
// through our own domain rather than switching to the Stripe dashboard.
export async function createAndSendInvoice(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const dealId = String(formData.get("deal_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const dueDateRaw = String(formData.get("due_date") ?? "");
  const billingEmailInput = String(formData.get("billing_email") ?? "").trim();

  if (!description || !amount || amount <= 0) throw new Error("Description and a positive amount are required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: client } = await supabase.from("clients").select("id, name, billing_email, stripe_customer_id, is_demo").eq("id", clientId).single();
  if (!client) throw new Error("Client not found");

  const billingEmail = client.billing_email || billingEmailInput;
  if (!billingEmail) throw new Error("This client has no billing email on file yet, enter one to send an invoice");
  if (!client.billing_email) {
    await supabase.from("clients").update({ billing_email: billingEmail }).eq("id", clientId);
  }

  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      client_id: clientId,
      deal_id: dealId,
      description,
      amount,
      due_date: dueDate?.toISOString() ?? null,
      created_by: user?.id,
      is_demo: client.is_demo,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Demo clients never touch the real Stripe account or send a real email —
  // demo data must never create a real financial artifact. Simulate "sent"
  // locally so the demo experience still shows a populated invoices list.
  if (client.is_demo) {
    await supabase.from("invoices").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", invoice.id);
    revalidatePath("/finance");
    return;
  }

  const { stripeInvoiceId, hostedInvoiceUrl } = await createAndFinalizeStripeInvoice(supabase, {
    invoiceId: invoice.id,
    client: { id: client.id, name: client.name, stripe_customer_id: client.stripe_customer_id, billing_email: billingEmail },
    description,
    amount,
    dueDate,
  });

  await supabase
    .from("invoices")
    .update({ stripe_invoice_id: stripeInvoiceId, hosted_invoice_url: hostedInvoiceUrl, status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoice.id);

  await sendInvoiceEmail(billingEmail, client.name, amount, dueDate, hostedInvoiceUrl);

  revalidatePath("/finance");
}

export async function voidInvoice(formData: FormData) {
  const invoiceId = String(formData.get("invoice_id"));
  const supabase = await createClient();

  const { data: invoice } = await supabase.from("invoices").select("stripe_invoice_id, status").eq("id", invoiceId).single();
  if (!invoice || invoice.status === "paid" || invoice.status === "void") return;

  if (invoice.stripe_invoice_id) await voidStripeInvoice(invoice.stripe_invoice_id);
  await supabase.from("invoices").update({ status: "void", voided_at: new Date().toISOString() }).eq("id", invoiceId);
  revalidatePath("/finance");
}

// §15.2 — a rep logging "payment collected" is a claim until verified.
export async function recordCollection(formData: FormData) {
  const deal_id = String(formData.get("deal_id"));
  const amount = Number(formData.get("amount"));
  const external_reference = String(formData.get("external_reference") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("collections").insert({
    deal_id,
    amount,
    external_reference,
    reported_by: user?.id,
  });

  revalidatePath("/finance");
}

// §15.2 — verifying a collection is what allows it to become RR receivable /
// rep-payable. If commission terms aren't configured yet, we still record the
// verified cash but block the calculation and flag it instead of inventing a rate.
export async function verifyCollection(formData: FormData) {
  const collectionId = String(formData.get("collection_id"));
  const dealId = String(formData.get("deal_id"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await verifyCollectionCore(supabase, { collectionId, dealId, verifiedBy: user?.id });
  revalidatePath("/finance");
}

// §15.3 — Finance/Admin can prepare a payout; only the founder's explicit
// approval below actually authorizes it, and "approved" is still not "paid".
export async function approvePayout(formData: FormData) {
  const walletEntryId = String(formData.get("wallet_entry_id"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("wallet_entries")
    .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq("id", walletEntryId)
    .eq("status", "payable");
  revalidatePath("/finance");
}

export async function markPayablePendingToPayable(formData: FormData) {
  const walletEntryId = String(formData.get("wallet_entry_id"));
  const supabase = await createClient();
  await supabase.from("wallet_entries").update({ status: "payable" }).eq("id", walletEntryId).eq("status", "pending_client_payment");
  revalidatePath("/finance");
}

// Recording an externally executed payment reference — this is not autonomous
// money movement, it's logging a transfer that already happened outside RR OS (§15.3).
export async function recordPayoutPaid(formData: FormData) {
  const walletEntryId = String(formData.get("wallet_entry_id"));
  const payment_reference = String(formData.get("payment_reference") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase
    .from("wallet_entries")
    .update({ status: "paid", paid_at: new Date().toISOString(), payment_reference })
    .eq("id", walletEntryId)
    .eq("status", "approved");
  revalidatePath("/finance");
}

// §24 — configuration register: real approved RR/rep rates must be entered
// explicitly, never invented by the builder.
export async function setClientRateBasis(formData: FormData) {
  const clientId = String(formData.get("client_id"));
  const rrRate = Number(formData.get("rr_rate"));
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ rr_rate_basis: { type: "cash_percentage", rr_rate: rrRate } })
    .eq("id", clientId);
  revalidatePath("/finance");
}

export async function setRepCompensationTerms(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id"));
  const rate = Number(formData.get("rate"));
  const basis = String(formData.get("basis"));
  const repId = String(formData.get("rep_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assignment } = await supabase
    .from("rep_assignments")
    .update({ compensation_terms: { type: "percentage", rate, basis } })
    .eq("id", assignmentId)
    .select("client_id, rep_id")
    .single();

  // Terms set (or changed) after a collection was already verified must not
  // silently leave that rep unpaid — recompute anything missed.
  let reconciled = { recomputedCount: 0, totalAmount: 0 };
  if (assignment) {
    reconciled = await reconcileMissingCommissions(supabase, { repId: assignment.rep_id, clientId: assignment.client_id, actorId: user?.id });
  }

  revalidatePath("/finance");
  if (repId) revalidatePath(`/reps/${repId}`);
  return reconciled;
}
