import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { createClient_ } from "./actions";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, lifecycle_state, workflow_type, signed_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Clients</h1>

        <form action={createClient_} className="mb-8 flex gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <input
            name="name"
            required
            placeholder="Client name"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <select
            name="workflow_type"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
          >
            <option value="closing_only">Closing only</option>
            <option value="setting_enabled">Setting enabled</option>
            <option value="azgari">Azgari (broker/candidate)</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
          >
            Sign new client
          </button>
        </form>

        <ul className="space-y-2">
          {(clients ?? []).map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-neutral-500">{c.workflow_type}</p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
                  {c.lifecycle_state}
                </span>
              </Link>
            </li>
          ))}
          {(clients ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">No clients yet. Sign your first one above.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
