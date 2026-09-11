import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateProspectStage, convertProspectToClient } from "../actions";

const STAGES = [
  "lead",
  "interested",
  "call_booked",
  "call_completed",
  "follow_up",
  "agreement_sent",
  "signed",
  "no_show",
  "not_fit",
];

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).single();
  if (!prospect) notFound();

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold">{prospect.company_name}</h1>
        <p className="mb-6 text-sm text-neutral-500">{prospect.contact_name} · {prospect.contact_email}</p>

        {prospect.converted_client_id ? (
          <p className="mb-6 rounded-lg bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
            Converted —{" "}
            <Link href={`/clients/${prospect.converted_client_id}`} className="underline">
              view Client 360
            </Link>
          </p>
        ) : (
          <form action={convertProspectToClient} className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3">
            <input type="hidden" name="prospect_id" value={prospect.id} />
            <input type="hidden" name="company_name" value={prospect.company_name} />
            <select name="workflow_type" className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm">
              <option value="closing_only">Closing only</option>
              <option value="setting_enabled">Setting enabled</option>
              <option value="azgari">Azgari (broker/candidate)</option>
            </select>
            <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white">
              Mark signed — create Client 360
            </button>
          </form>
        )}

        <form action={updateProspectStage} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <input type="hidden" name="id" value={prospect.id} />
          <label className="block text-sm">
            Stage
            <select
              name="stage"
              defaultValue={prospect.stage}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Qualification notes
            <textarea
              name="qualification_notes"
              defaultValue={prospect.qualification_notes ?? ""}
              rows={2}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Proposed plan
            <textarea
              name="proposed_plan"
              defaultValue={prospect.proposed_plan ?? ""}
              rows={2}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Next action
            <input
              name="next_action"
              defaultValue={prospect.next_action ?? ""}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Next action date
            <input
              type="datetime-local"
              name="next_action_date"
              defaultValue={prospect.next_action_date?.slice(0, 16) ?? ""}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
            />
          </label>
          <button className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900">Save</button>
        </form>
      </div>
    </div>
  );
}
