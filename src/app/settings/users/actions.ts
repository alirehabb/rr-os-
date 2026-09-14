"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

const FROM = "Rehab Revenue OS <team@hiring.rehab-revenue.com>";

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r) => r.role === "founder")) throw new Error("Founder access required");
  return { supabase, user };
}

// §2 — a candidate in Talent never gets system access automatically. Inviting
// is the one explicit act that turns someone into a real RR OS user.
export async function inviteUser(formData: FormData) {
  const { supabase, user } = await requireFounder();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as AppRole;
  const client_id = String(formData.get("client_id") ?? "") || null;
  const rep_id = String(formData.get("rep_id") ?? "") || null;

  if (!email || !full_name || !role) throw new Error("Name, email, and role are required");

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existingProfile) throw new Error("A user with this email already exists");

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({ email, full_name, role, client_id, rep_id, invited_by: user.id })
    .select("token")
    .single();
  if (error) throw new Error(error.message);

  await sendInviteEmail(email, full_name, invitation.token);

  revalidatePath("/settings/users");
}

export async function resendInvitation(formData: FormData) {
  await requireFounder();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: invitation, error } = await supabase
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" })
    .eq("id", id)
    .select("email, full_name, token")
    .single();
  if (error) throw new Error(error.message);

  await sendInviteEmail(invitation.email, invitation.full_name, invitation.token);
  revalidatePath("/settings/users");
}

export async function revokeInvitation(formData: FormData) {
  const { supabase } = await requireFounder();
  const id = String(formData.get("id"));
  await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
  revalidatePath("/settings/users");
}

export async function setUserStatus(formData: FormData) {
  const { supabase } = await requireFounder();
  const userId = String(formData.get("user_id"));
  const status = String(formData.get("status")) as "active" | "suspended";
  await supabase.from("profiles").update({ status }).eq("id", userId);
  revalidatePath("/settings/users");
}

export async function addUserRole(formData: FormData) {
  const { supabase } = await requireFounder();
  const userId = String(formData.get("user_id"));
  const role = String(formData.get("role")) as AppRole;
  const client_id = String(formData.get("client_id") ?? "") || null;
  await supabase.from("user_roles").insert({ user_id: userId, role, client_id });
  revalidatePath("/settings/users");
}

export async function removeUserRole(formData: FormData) {
  const { supabase } = await requireFounder();
  const id = String(formData.get("id"));
  await supabase.from("user_roles").delete().eq("id", id);
  revalidatePath("/settings/users");
}

async function sendInviteEmail(email: string, fullName: string, token: string) {
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://rr-os-three.vercel.app"}/invite/${token}`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "You've been invited to Rehab Revenue OS",
        html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">
          <p>Hi ${fullName},</p>
          <p>You've been invited to Rehab Revenue OS. Set your password to get started:</p>
          <p><a href="${acceptUrl}">${acceptUrl}</a></p>
          <p>This link expires in 14 days.</p>
        </div>`,
      }),
    });
  } catch {
    // best-effort — the invitation row is the source of truth, the founder
    // can always copy the accept link manually if the email fails
  }
}

// Server-side lookup for the invite-acceptance page, which runs with no
// session — never exposed as a browser-queryable table (see migration RLS).
export async function getInvitationByToken(token: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, email, full_name, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  return data;
}

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token"));
  const password = String(formData.get("password"));
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const service = createServiceClient();
  const { data: invitation } = await service
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!invitation || invitation.status !== "pending") throw new Error("This invitation is no longer valid");
  if (new Date(invitation.expires_at) < new Date()) throw new Error("This invitation has expired");

  const { data: created, error } = await service.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  await service.from("profiles").insert({ id: created.user.id, full_name: invitation.full_name, email: invitation.email });
  await service.from("user_roles").insert({ user_id: created.user.id, role: invitation.role, client_id: invitation.client_id });
  if (invitation.rep_id) {
    await service.from("reps").update({ profile_id: created.user.id }).eq("id", invitation.rep_id);
  }
  await service.from("invitations").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invitation.id);

  return { success: true };
}
