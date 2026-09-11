import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { createOpportunity } from "../actions";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id } = await searchParams;
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Log a booked call</h1>
        <form action={createOpportunity} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <label className="block text-sm">
            Client
            <select
              name="client_id"
              defaultValue={client_id}
              required
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            >
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Prospect name
            <input
              name="prospect_name"
              required
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Prospect contact (email/phone)
            <input
              name="prospect_contact"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Source
            <input
              name="source"
              placeholder="e.g. Calendly, referral"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Scheduled call time
            <input
              type="datetime-local"
              name="scheduled_at"
              required
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">
            Create opportunity
          </button>
        </form>
      </div>
    </div>
  );
}
