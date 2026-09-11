import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { createProspect } from "./actions";

export default async function ProspectsPage() {
  const supabase = await createClient();
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, company_name, stage, source, next_action_date")
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold">RR Acquisition Pipeline</h1>

        <form action={createProspect} className="mb-8 flex gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <input
            name="company_name"
            required
            placeholder="Company name"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
          />
          <input
            name="contact_name"
            placeholder="Contact name"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
          />
          <input
            name="contact_email"
            type="email"
            placeholder="Contact email"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
          />
          <select name="source" className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm">
            <option value="manual">Manual</option>
            <option value="website">Website pre-qual</option>
            <option value="instantly">Instantly</option>
            <option value="calendly">Calendly discovery</option>
          </select>
          <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900">Add</button>
        </form>

        <ul className="space-y-2">
          {(prospects ?? []).map((p) => (
            <li key={p.id}>
              <Link
                href={`/prospects/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600"
              >
                <div>
                  <p className="font-medium">{p.company_name}</p>
                  <p className="text-sm text-neutral-500">{p.source}</p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">{p.stage}</span>
              </Link>
            </li>
          ))}
          {(prospects ?? []).length === 0 && <p className="text-sm text-neutral-500">No prospects yet.</p>}
        </ul>
      </div>
    </div>
  );
}
