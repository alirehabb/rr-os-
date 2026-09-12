"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { slackAuthTest } from "@/lib/slack";

const KNOWN_PROVIDERS = ["resend", "calendly", "slack", "stripe", "google_calendar", "docusign"];

// §19 — every connection needs visible status; ensure a row exists for each
// known provider so an unconfigured integration is an explicit "disconnected"
// row, never silent absence.
export async function ensureConnectionRows() {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("connections").select("provider").is("client_id", null);
  const existingProviders = new Set((existing ?? []).map((c) => c.provider));

  const missing = KNOWN_PROVIDERS.filter((p) => !existingProviders.has(p));
  if (missing.length > 0) {
    await supabase.from("connections").insert(missing.map((provider) => ({ provider, status: "disconnected" as const })));
  }
}

// A real check against our own stored Resend key — not a fabricated status.
export async function checkResendConnection() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let status: "connected" | "degraded" | "disconnected" = "disconnected";
  let last_error: string | null = null;

  try {
    const res = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (res.ok) status = "connected";
    else {
      status = "degraded";
      last_error = `Resend responded ${res.status}`;
    }
  } catch (e) {
    status = "disconnected";
    last_error = e instanceof Error ? e.message : "Unknown error";
  }

  await supabase
    .from("connections")
    .update({ status, last_attempt_at: now, last_synced_at: status === "connected" ? now : undefined, last_error })
    .eq("provider", "resend")
    .is("client_id", null);

  revalidatePath("/connections");
  return { status, last_error };
}

// A real check against our own stored Calendly token — not a fabricated status.
export async function checkCalendlyConnection() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let status: "connected" | "degraded" | "disconnected" = "disconnected";
  let last_error: string | null = null;
  let authorized_account: string | null = null;

  try {
    const res = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${process.env.CALENDLY_API_TOKEN}` },
    });
    if (res.ok) {
      const data = await res.json();
      status = "connected";
      authorized_account = data.resource?.email ?? null;
    } else {
      status = "degraded";
      last_error = `Calendly responded ${res.status}`;
    }
  } catch (e) {
    status = "disconnected";
    last_error = e instanceof Error ? e.message : "Unknown error";
  }

  await supabase
    .from("connections")
    .update({ status, authorized_account, last_attempt_at: now, last_synced_at: status === "connected" ? now : undefined, last_error })
    .eq("provider", "calendly")
    .is("client_id", null);

  revalidatePath("/connections");
  return { status, last_error };
}

// A real check against our own stored Stripe key — not a fabricated status.
export async function checkStripeConnection() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let status: "connected" | "degraded" | "disconnected" = "disconnected";
  let last_error: string | null = null;
  let authorized_account: string | null = null;

  try {
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (res.ok) {
      const data = await res.json();
      status = "connected";
      authorized_account = data.email ?? data.id ?? null;
    } else {
      status = "degraded";
      last_error = `Stripe responded ${res.status}`;
    }
  } catch (e) {
    status = "disconnected";
    last_error = e instanceof Error ? e.message : "Unknown error";
  }

  await supabase
    .from("connections")
    .update({ status, authorized_account, last_attempt_at: now, last_synced_at: status === "connected" ? now : undefined, last_error })
    .eq("provider", "stripe")
    .is("client_id", null);

  revalidatePath("/connections");
  return { status, last_error };
}

// A real check against our own stored Slack bot token — not a fabricated status.
export async function checkSlackConnection() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let status: "connected" | "degraded" | "disconnected" = "disconnected";
  let last_error: string | null = null;
  let authorized_account: string | null = null;

  try {
    const data = await slackAuthTest();
    if (data.ok) {
      status = "connected";
      authorized_account = data.team ? `${data.team} (#${data.user})` : null;
    } else {
      status = "degraded";
      last_error = data.error ?? "Slack responded not-ok";
    }
  } catch (e) {
    status = "disconnected";
    last_error = e instanceof Error ? e.message : "Unknown error";
  }

  await supabase
    .from("connections")
    .update({ status, authorized_account, last_attempt_at: now, last_synced_at: status === "connected" ? now : undefined, last_error })
    .eq("provider", "slack")
    .is("client_id", null);

  revalidatePath("/connections");
  return { status, last_error };
}

// Manual status update for providers without an automated check yet (§19 —
// an integration capability must match the provider's actual permissions;
// we don't claim OAuth we haven't performed).
export async function updateConnectionStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const authorized_account = String(formData.get("authorized_account") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("connections")
    .update({ status, authorized_account, owner_id: user?.id, last_attempt_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/connections");
}
