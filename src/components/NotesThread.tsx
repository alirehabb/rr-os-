import { createClient } from "@/lib/supabase/server";
import { addNote } from "@/app/communications/actions";
import { SectionTitle, Card, Textarea, Select, Button, EmptyState } from "@/components/ui";

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
      <SectionTitle>Notes</SectionTitle>
      <form action={addNote} className="mb-3 space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-sm shadow-black/[0.03]">
        <input type="hidden" name="subject_type" value={subjectType} />
        <input type="hidden" name="subject_id" value={subjectId} />
        <input type="hidden" name="client_id" value={clientId ?? ""} />
        <input type="hidden" name="revalidate_path" value={revalidatePath} />
        <Textarea name="body" required rows={2} placeholder="Add a note..." />
        <div className="flex items-center justify-between">
          <Select name="visibility" className="!px-2 !py-1 text-xs">
            <option value="internal">Internal only</option>
            <option value="client">Visible to client</option>
            <option value="rep">Visible to rep</option>
          </Select>
          <Button className="!px-3 !py-1 text-xs">Post</Button>
        </div>
      </form>

      <ul className="space-y-2">
        {(notes ?? []).map((n) => (
          <li key={n.id}>
            <Card className="text-sm">
              <p className="text-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-faint">
                {n.visibility} · {new Date(n.created_at).toLocaleString()}
              </p>
            </Card>
          </li>
        ))}
        {(notes ?? []).length === 0 && <EmptyState title="No notes yet." />}
      </ul>
    </section>
  );
}
