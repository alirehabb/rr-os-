import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { createDocument } from "./actions";
import { PageHeader, LinkCard, Badge, Button, Input, Select, EmptyState } from "@/components/ui";

const STATUS_TONE = {
  draft: "neutral",
  sent_for_signature: "warning",
  executed: "success",
} as const;

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [{ data: documents }, { data: clients }] = await Promise.all([
    supabase.from("documents").select("id, title, doc_type, status, client_id").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PageHeader title="Documents" />

        <form action={createDocument} className="mb-8 flex gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.03]">
          <Input name="title" required placeholder="Document title" className="flex-1" />
          <Select name="doc_type">
            <option value="agreement">Agreement</option>
            <option value="training">Training</option>
            <option value="other">Other</option>
          </Select>
          <Select name="client_id">
            <option value="">No client (internal)</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button>Create draft</Button>
        </form>

        <ul className="space-y-2">
          {(documents ?? []).map((d) => (
            <li key={d.id}>
              <LinkCard href={`/documents/${d.id}`} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{d.title}</p>
                  <p className="text-sm text-muted">
                    {d.doc_type} · {d.client_id ? clientNameById.get(d.client_id) ?? "Unknown client" : "Internal"}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[d.status as keyof typeof STATUS_TONE] ?? "neutral"}>{d.status.replace(/_/g, " ")}</Badge>
              </LinkCard>
            </li>
          ))}
          {(documents ?? []).length === 0 && <EmptyState title="No documents yet." />}
        </ul>
      </div>
    </div>
  );
}
