import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { notFound } from "next/navigation";
import { generateReport, sendReport } from "./actions";
import type { ClientReportSnapshot } from "@/lib/clientReport";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function ClientReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ report_id?: string }>;
}) {
  const { id } = await params;
  const { report_id } = await searchParams;
  const supabase = await createClient();

  const [{ data: client }, { data: reports }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).single(),
    supabase.from("client_reports").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();

  const current = report_id ? reports?.find((r) => r.id === report_id) : reports?.[0];
  const snapshot = current?.snapshot as ClientReportSnapshot | undefined;

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold">{client.name} — Report</h1>

        <form action={generateReport} className="mb-6 flex items-center gap-2">
          <input type="hidden" name="client_id" value={id} />
          <select name="period_days" defaultValue="7" className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <button className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900">
            Generate new report
          </button>
        </form>

        {!snapshot ? (
          <p className="text-sm text-neutral-500">No reports generated yet.</p>
        ) : (
          <>
            <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm">
              <p className="mb-3 text-neutral-400">
                Period: {new Date(snapshot.periodStart).toLocaleDateString()} –{" "}
                {new Date(snapshot.periodEnd).toLocaleDateString()} · {current?.delivery_status}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Booked calls" value={String(snapshot.bookedCalls)} />
                <Stat label="Attended / No-show / Cancelled" value={`${snapshot.attended} / ${snapshot.noShow} / ${snapshot.cancelled}`} />
                <Stat label="New opportunities" value={String(snapshot.newOpportunities)} />
                <Stat label="Active pipeline" value={money(snapshot.activePipelineValue)} />
                <Stat label="Deals won" value={`${snapshot.dealsWon} (${money(snapshot.dealsWonValue)})`} />
                <Stat label="Collections (reported / verified)" value={`${money(snapshot.reportedCollections)} / ${money(snapshot.verifiedCollections)}`} />
              </div>

              <h3 className="mb-1 mt-4 font-medium">Actions RR Is Taking</h3>
              <ul className="list-inside list-disc text-neutral-300">
                {snapshot.actionsRRIsTaking.length === 0 && <li className="text-neutral-500">None outstanding</li>}
                {snapshot.actionsRRIsTaking.map((a, i) => (
                  <li key={i}>{a.title}</li>
                ))}
              </ul>

              <h3 className="mb-1 mt-4 font-medium">Required from Client</h3>
              <ul className="list-inside list-disc text-neutral-300">
                {snapshot.requiredFromClient.length === 0 && <li className="text-neutral-500">Nothing outstanding</li>}
                {snapshot.requiredFromClient.map((r, i) => (
                  <li key={i}>{r.label}</li>
                ))}
              </ul>
            </div>

            {current && (
              <form action={sendReport} className="flex gap-2">
                <input type="hidden" name="report_id" value={current.id} />
                <input type="hidden" name="client_id" value={id} />
                <input
                  name="recipient_emails"
                  required
                  placeholder="client@example.com, another@example.com"
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
                />
                <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
                  Send via Resend
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
