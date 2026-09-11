import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type RepRow = {
  id: string;
  fullName: string;
  isBenchmark: boolean;
  closeRate: number | null;
  cashCollected: number;
  commissionEarned: number;
  rrScore: number | null;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: reps }, { data: opportunities }, { data: ledger }, { data: deals }, { data: collections }] =
    await Promise.all([
      supabase.from("reps").select("id, full_name, is_benchmark, benchmark_stats"),
      supabase.from("opportunities").select("id, owner_rep_id, stage"),
      supabase.from("ledger_entries").select("rep_id, entry_type, amount"),
      supabase.from("deals").select("id, opportunity_id"),
      supabase.from("collections").select("deal_id, amount, status"),
    ]);

  const dealByOppId = new Map((deals ?? []).map((d) => [d.opportunity_id, d.id]));

  const rows: RepRow[] = (reps ?? []).map((r) => {
    if (r.is_benchmark) {
      const stats = (r.benchmark_stats as Record<string, number | null>) ?? {};
      return {
        id: r.id,
        fullName: r.full_name,
        isBenchmark: true,
        closeRate: stats.close_rate ?? null,
        cashCollected: stats.cash_collected ?? 0,
        commissionEarned: stats.commission_earned ?? 0,
        rrScore: stats.rr_score ?? null,
      };
    }

    const repOpps = (opportunities ?? []).filter((o) => o.owner_rep_id === r.id);
    const attended = repOpps.filter((o) => o.stage === "won" || o.stage === "lost");
    const won = repOpps.filter((o) => o.stage === "won");
    const closeRate = attended.length > 0 ? won.length / attended.length : null;

    const repDealIds = repOpps.map((o) => dealByOppId.get(o.id)).filter(Boolean) as string[];
    const cashCollected = (collections ?? [])
      .filter((c) => repDealIds.includes(c.deal_id) && c.status === "verified")
      .reduce((s, c) => s + Number(c.amount), 0);

    const commissionEarned = (ledger ?? [])
      .filter((l) => l.rep_id === r.id && l.entry_type === "rep_commission_earned")
      .reduce((s, l) => s + Number(l.amount), 0);

    return {
      id: r.id,
      fullName: r.full_name,
      isBenchmark: false,
      closeRate,
      cashCollected,
      commissionEarned,
      rrScore: null, // §21.2 — RR Score weights are not configured; never fabricated.
    };
  });

  const realRows = rows.filter((r) => !r.isBenchmark);
  const benchmarkRows = rows.filter((r) => r.isBenchmark);

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold">Leaderboard</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Benchmark rows are clearly labeled hypothetical profiles for motivation — they never count toward real
          company totals (§21.1).
        </p>

        <Board title="Close Rate" real={realRows} benchmarks={benchmarkRows} metric="closeRate" format={(v) => (v === null ? "—" : `${Math.round(v * 100)}%`)} />
        <Board title="Cash Collected" real={realRows} benchmarks={benchmarkRows} metric="cashCollected" format={(v) => money(v as number)} />
        <Board title="Commission Earned" real={realRows} benchmarks={benchmarkRows} metric="commissionEarned" format={(v) => money(v as number)} />
        <Board
          title="RR Score"
          real={realRows}
          benchmarks={benchmarkRows}
          metric="rrScore"
          format={(v) => (v === null ? "awaiting configuration" : String(v))}
        />
      </div>
    </div>
  );
}

function Board({
  title,
  real,
  benchmarks,
  metric,
  format,
}: {
  title: string;
  real: RepRow[];
  benchmarks: RepRow[];
  metric: keyof RepRow;
  format: (v: number | null) => string;
}) {
  const sorted = [...real].sort((a, b) => Number(b[metric] ?? -1) - Number(a[metric] ?? -1));

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      <ul className="space-y-1 text-sm">
        {sorted.map((r) => (
          <li key={r.id} className="flex justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
            <span>{r.fullName}</span>
            <span className="text-neutral-300">{format(r[metric] as number | null)}</span>
          </li>
        ))}
        {sorted.length === 0 && <li className="text-neutral-500">No reps yet.</li>}
        {benchmarks.map((r) => (
          <li
            key={r.id}
            className="flex justify-between rounded-lg border border-dashed border-amber-900 bg-amber-950/30 px-3 py-2 text-amber-300"
          >
            <span>{r.fullName} (hypothetical)</span>
            <span>{format(r[metric] as number | null)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
