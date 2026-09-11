import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { createDocument } from "./actions";

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
        <h1 className="mb-6 text-2xl font-semibold">Documents</h1>

        <form action={createDocument} className="mb-8 flex gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <input
            name="title"
            required
            placeholder="Document title"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
          />
          <select name="doc_type" className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm">
            <option value="agreement">Agreement</option>
            <option value="training">Training</option>
            <option value="other">Other</option>
          </select>
          <select name="client_id" className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm">
            <option value="">No client (internal)</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900">Create draft</button>
        </form>

        <ul className="space-y-2">
          {(documents ?? []).map((d) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600"
              >
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-sm text-neutral-500">
                    {d.doc_type} · {d.client_id ? clientNameById.get(d.client_id) ?? "Unknown client" : "Internal"}
                  </p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">{d.status}</span>
              </Link>
            </li>
          ))}
          {(documents ?? []).length === 0 && <p className="text-sm text-neutral-500">No documents yet.</p>}
        </ul>
      </div>
    </div>
  );
}
