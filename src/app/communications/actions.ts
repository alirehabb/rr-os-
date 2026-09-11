"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// §17.1 — a contextual note attached to one record, with explicit visibility.
// Internal notes never leak into client reports or rep views (enforced by RLS,
// not just this form — see communications RLS policies).
export async function addNote(formData: FormData) {
  const subject_type = String(formData.get("subject_type"));
  const subject_id = String(formData.get("subject_id"));
  const client_id = String(formData.get("client_id") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "internal");
  const revalidate = String(formData.get("revalidate_path"));

  if (!body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("communications").insert({
    subject_type,
    subject_id,
    client_id,
    body,
    visibility,
    author_id: user?.id,
  });

  revalidatePath(revalidate);
}
