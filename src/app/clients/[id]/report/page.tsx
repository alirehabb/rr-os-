import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import { notFound } from "next/navigation";
import { generateReport, sendReport } from "./actions";
import type { ClientReportSnapshot } from "@/lib/clientReport";
import { PageHeader, Card, StatTile, Button, Select, Input, EmptyState } from "@/components/ui";

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
        <PageHeader title={`${client.name} — Report`} />

        <form action={generateReport} className="mb-6 flex items-center gap-2">
          <input type="hidden" name="client_id" value={id} />
          <Select name="period_days" defaultValue="7">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </Select>
          <Button type="submit" variant="secondary">
            Generate new report
          </Button>
        </form>

        {!snapshot ? (
          <EmptyState title="No reports generated yet." />
        ) : (
          <>
            <Card className="mb-6 text-sm">
              <p className="mb-3 text-muted">
                Period: {new Date(snapshot.periodStart).toLocaleDateString()} – {new Date(snapshot.periodEnd).toLocaleDateString()} ·{" "}
                {current?.delivery_status}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Booked calls" value={String(snapshot.bookedCalls)} />
                <StatTile label="Attended / No-show / Cancelled" value={`${snapshot.attended} / ${snapshot.noShow} / ${snapshot.cancelled}`} />
                <StatTile label="New opportunities" value={String(snapshot.newOpportunities)} />
                <StatTile label="Active pipeline" value={money(snapshot.activePipelineValue)} tone="accent" />
                <StatTile label="Deals won" value={`${snapshot.dealsWon} (${money(snapshot.dealsWonValue)})`} tone="success" />
                <StatTile label="Collections (reported / verified)" value={`${money(snapshot.reportedCollections)} / ${money(snapshot.verifiedCollections)}`} />
              </div>

              <h3 className="mb-1 mt-5 text-sm font-medium text-foreground">Actions RR Is Taking</h3>
              <ul className="list-inside list-disc text-muted">
                {snapshot.actionsRRIsTaking.length === 0 && <li className="text-faint">None outstanding</li>}
                {snapshot.actionsRRIsTaking.map((a, i) => (
                  <li key={i}>{a.title}</li>
                ))}
              </ul>

              <h3 className="mb-1 mt-4 text-sm font-medium text-foreground">Required from Client</h3>
              <ul className="list-inside list-disc text-muted">
                {snapshot.requiredFromClient.length === 0 && <li className="text-faint">Nothing outstanding</li>}
                {snapshot.requiredFromClient.map((r, i) => (
                  <li key={i}>{r.label}</li>
                ))}
              </ul>
            </Card>

            {current && (
              <form action={sendReport} className="flex gap-2">
                <input type="hidden" name="report_id" value={current.id} />
                <input type="hidden" name="client_id" value={id} />
                <Input name="recipient_emails" required placeholder="client@example.com, another@example.com" className="flex-1" />
                <button className="rounded-xl bg-success px-4 py-2 text-sm font-medium text-background transition-transform active:scale-[0.97]">
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
