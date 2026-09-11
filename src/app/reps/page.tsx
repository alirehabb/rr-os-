import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { createRep } from "./actions";

export default async function RepsPage() {
  const supabase = await createClient();
  const { data: reps } = await supabase
    .from("reps")
    .select("id, full_name, email, recruiting_status, capabilities")
    .eq("is_benchmark", false)
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Sales Talent</h1>

        <form action={createRep} className="mb-8 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex gap-2">
            <input
              name="full_name"
              required
              placeholder="Full name"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
            <label className="flex items-center gap-1">
              <input type="checkbox" name="capabilities" value="closer" /> Closer
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" name="capabilities" value="setter" /> Setter
            </label>
            <input
              name="geography"
              placeholder="Geography"
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
            />
            <input
              name="timezone"
              placeholder="Timezone"
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
            />
            <input
              name="claimed_cash_collected"
              type="number"
              placeholder="Claimed cash collected"
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
            />
          </div>
          <input
            name="evidence_source"
            placeholder="Evidence source (Loom link, referral, past recordings...)"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900">
            Add applicant
          </button>
        </form>

        <ul className="space-y-2">
          {(reps ?? []).map((r) => (
            <li key={r.id}>
              <Link
                href={`/reps/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600"
              >
                <div>
                  <p className="font-medium">{r.full_name}</p>
                  <p className="text-sm text-neutral-500">{r.email} · {r.capabilities.join(", ") || "no role set"}</p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
                  {r.recruiting_status}
                </span>
              </Link>
            </li>
          ))}
          {(reps ?? []).length === 0 && <p className="text-sm text-neutral-500">No applicants yet.</p>}
        </ul>
      </div>
    </div>
  );
}
