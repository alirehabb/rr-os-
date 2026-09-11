import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";

export default async function OpportunitiesPage() {
  const supabase = await createClient();
  const [{ data: opportunities }, { data: clients }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, prospect_name, stage, value, client_id")
      .order("first_booked_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
  ]);
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Opportunities</h1>
        <ul className="space-y-2">
          {(opportunities ?? []).map((o) => (
            <li key={o.id}>
              <Link
                href={`/opportunities/${o.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600"
              >
                <div>
                  <p className="font-medium">{o.prospect_name}</p>
                  <p className="text-sm text-neutral-500">{clientNameById.get(o.client_id) ?? "Unknown client"}</p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300">{o.stage}</span>
              </Link>
            </li>
          ))}
          {(opportunities ?? []).length === 0 && (
            <p className="text-sm text-neutral-500">No booked calls yet. Log one from a Client 360 page.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
