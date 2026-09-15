"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getDemoMode } from "@/lib/demoMode";
import { revalidatePath } from "next/cache";
import DOMPurify from "isomorphic-dompurify";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];
type ItemType = Database["public"]["Enums"]["knowledge_item_type"];

export async function createFolder(formData: FormData) {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = String(formData.get("name") ?? "").trim();
  const parent_id = String(formData.get("parent_id") ?? "") || null;
  const client_id = String(formData.get("client_id") ?? "") || null;
  if (!name) throw new Error("Folder name is required");

  await supabase.from("folders").insert({ name, parent_id, client_id, created_by: user?.id, is_demo: demoMode });
  revalidatePath("/library");
}

// Handles all five content types in one action: doc/template store markdown
// body, video/link store an external URL, file/image upload straight into
// the private "knowledge" storage bucket.
export async function createItem(formData: FormData) {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "doc") as ItemType;
  const folder_id = String(formData.get("folder_id") ?? "") || null;
  const client_id = String(formData.get("client_id") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim() || null;
  const external_url = String(formData.get("external_url") ?? "").trim() || null;
  const file = formData.get("file") as File | null;
  if (!title) throw new Error("Title is required");

  let storage_path: string | null = null;
  if ((type === "file" || type === "image") && file && file.size > 0) {
    storage_path = `${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("knowledge").upload(storage_path, file);
    if (uploadError) throw new Error(uploadError.message);
  }

  const { error } = await supabase.from("knowledge_items").insert({
    title,
    type,
    folder_id,
    client_id,
    body,
    external_url,
    storage_path,
    created_by: user?.id,
    is_demo: demoMode,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/library");
}

// Doc/template editing: DocEditor.tsx autosaves Tiptap's HTML output here.
// Sanitized on the way in, not just on render — an item's HTML can be shown
// to assignees who never see this action, so it must already be clean.
export async function updateItemBody(itemId: string, html: string) {
  const supabase = await createClient();
  const clean = DOMPurify.sanitize(html);
  await supabase.from("knowledge_items").update({ body: clean, updated_at: new Date().toISOString() }).eq("id", itemId);
  revalidatePath("/library");
  revalidatePath("/my");
  revalidatePath("/portal");
}

export async function deleteItem(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();

  const { data: item } = await supabase.from("knowledge_items").select("storage_path").eq("id", id).single();
  if (item?.storage_path) await supabase.storage.from("knowledge").remove([item.storage_path]);
  await supabase.from("knowledge_items").delete().eq("id", id);
  revalidatePath("/library");
}

export async function deleteFolder(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("folders").delete().eq("id", id);
  revalidatePath("/library");
}

// One assignment = one target (a specific rep, an entire role as a broadcast,
// or a client). Re-assigning the same target is idempotent by unique-ish
// intent, not enforced at the DB level, so this just inserts a fresh row.
export async function assignItem(formData: FormData) {
  const supabase = await createClient();
  const demoMode = await getDemoMode(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const item_id = String(formData.get("item_id"));
  const target = String(formData.get("target") ?? "");
  if (!target) throw new Error("Choose who to assign this to");

  const [kind, value] = target.split(":");
  const insert: { item_id: string; rep_id?: string; role?: AppRole; client_id?: string; assigned_by?: string; is_demo: boolean } = {
    item_id,
    assigned_by: user?.id,
    is_demo: demoMode,
  };
  if (kind === "rep") insert.rep_id = value;
  else if (kind === "role") insert.role = value as AppRole;
  else if (kind === "client") insert.client_id = value;
  else throw new Error("Invalid assignment target");

  await supabase.from("knowledge_assignments").insert(insert);
  revalidatePath("/library");
}

export async function removeAssignment(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("knowledge_assignments").delete().eq("id", id);
  revalidatePath("/library");
}

// Assignee-side: mark their own copy viewed/acknowledged. RLS restricts
// this to assignments that actually resolve to the caller.
export async function markAssignmentViewed(assignmentId: string) {
  const supabase = await createClient();
  await supabase.from("knowledge_assignments").update({ viewed_at: new Date().toISOString() }).eq("id", assignmentId).is("viewed_at", null);
}

export async function acknowledgeAssignment(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id"));
  const supabase = await createClient();
  await supabase.from("knowledge_assignments").update({ acknowledged_at: new Date().toISOString() }).eq("id", assignmentId);
  revalidatePath("/my");
  revalidatePath("/portal");
}

// Files live in a private bucket — everyone (founder included) reaches them
// through a short-lived signed URL rather than a public link. Visibility is
// checked against the caller's own RLS-scoped session first (storage_path
// being hard to guess isn't itself an access control), then the actual
// signed URL is minted with the service role since storage.objects has no
// per-assignee policy of its own.
export async function getSignedFileUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: visible } = await supabase.from("knowledge_items").select("id").eq("storage_path", storagePath).maybeSingle();
  if (!visible) return null;

  const service = createServiceClient();
  const { data } = await service.storage.from("knowledge").createSignedUrl(storagePath, 60 * 10);
  return data?.signedUrl ?? null;
}
