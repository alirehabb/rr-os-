import { createClient } from "@/lib/supabase/server";
import { addNote } from "@/app/communications/actions";

export default async function NotesThread({
  subjectType,
  subjectId,
  clientId,
  revalidatePath,
}: {
  subjectType: "client" | "rep" | "opportunity" | "call" | "action_item";
  subjectId: string;
  clientId?: string | null;
  revalidatePath: string;
}) {
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("communications")
    .select("id, body, visibility, created_at, author_id")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Notes</h2>
      <form action={addNote} className="mb-3 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <input type="hidden" name="subject_type" value={subjectType} />
        <input type="hidden" name="subject_id" value={subjectId} />
        <input type="hidden" name="client_id" value={clientId ?? ""} />
        <input type="hidden" name="revalidate_path" value={revalidatePath} />
        <textarea
          name="body"
          required
          rows={2}
          placeholder="Add a note..."
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          <select name="visibility" className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs">
            <option value="internal">Internal only</option>
            <option value="client">Visible to client</option>
            <option value="rep">Visible to rep</option>
          </select>
          <button className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-900">Post</button>
        </div>
      </form>

      <ul className="space-y-2">
        {(notes ?? []).map((n) => (
          <li key={n.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <p>{n.body}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {n.visibility} · {new Date(n.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {(notes ?? []).length === 0 && <p className="text-sm text-neutral-500">No notes yet.</p>}
      </ul>
    </section>
  );
}
