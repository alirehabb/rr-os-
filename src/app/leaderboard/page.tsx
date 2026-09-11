import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Link from "next/link";

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
  rrScoreProvisional: boolean;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: reps }, { data: opportunities }, { data: ledger }, { data: deals }, { data: collections }, { data: config }] =
    await Promise.all([
      supabase.from("reps").select("id, full_name, is_benchmark, benchmark_stats"),
      supabase.from("opportunities").select("id, owner_rep_id, stage"),
      supabase.from("ledger_entries").select("rep_id, entry_type, amount"),
      supabase.from("deals").select("id, opportunity_id"),
      supabase.from("collections").select("deal_id, amount, status"),
      supabase.from("rr_score_config").select("*").limit(1).single(),
    ]);

  const nonTerminalOppIds = (opportunities ?? [])
    .filter((o) => o.stage !== "won" && o.stage !== "lost")
    .map((o) => o.id);
  const { data: nonTerminalCalls } = nonTerminalOppIds.length
    ? await supabase.from("calls").select("opportunity_id, agreed_next_action, scheduled_at").in("opportunity_id", nonTerminalOppIds)
    : { data: [] };

  // §21.2 — only two components have a real data source tonight (close rate,
  // follow-up discipline). If the config weights any of the other three
  // components above zero, the score is honestly marked provisional rather
  // than silently treating missing data as zero.
  const missingComponentsWeighted =
    !!config?.configured &&
    (config.weight_call_quality > 0 || config.weight_client_representation > 0 || config.weight_consistency > 0);

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
        rrScoreProvisional: false,
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

    // follow-up discipline: of this rep's nonterminal opportunities, what
    // fraction have a most-recent call with an agreed next action set (§12).
    const nonTerminal = repOpps.filter((o) => o.stage !== "won" && o.stage !== "lost");
    const followUpDiscipline =
      nonTerminal.length === 0
        ? null
        : nonTerminal.filter((o) => {
            const oppCalls = (nonTerminalCalls ?? [])
              .filter((c) => c.opportunity_id === o.id)
              .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
            return !!oppCalls[0]?.agreed_next_action;
          }).length / nonTerminal.length;

    let rrScore: number | null = null;
    if (config?.configured && closeRate !== null) {
      const w = config.weight_sales_performance;
      const wf = config.weight_follow_up_discipline;
      const usableWeight = w + (followUpDiscipline !== null ? wf : 0);
      if (usableWeight > 0) {
        rrScore = Math.round(
          ((closeRate * w + (followUpDiscipline ?? 0) * (followUpDiscipline !== null ? wf : 0)) / usableWeight) * 100,
        );
      }
    }

    return {
      id: r.id,
      fullName: r.full_name,
      isBenchmark: false,
      closeRate,
      cashCollected,
      commissionEarned,
      rrScore,
      rrScoreProvisional: missingComponentsWeighted,
    };
  });

  const realRows = rows.filter((r) => !r.isBenchmark);
  const benchmarkRows = rows.filter((r) => r.isBenchmark);

  return (
    <div className="flex-1">
      <NavBar />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold">Leaderboard</h1>
        <p className="mb-2 text-sm text-neutral-500">
          Benchmark rows are clearly labeled hypothetical profiles for motivation — they never count toward real
          company totals (§21.1).
        </p>
        <p className="mb-6 text-xs text-neutral-600">
          <Link href="/settings/rr-score" className="underline">
            Configure RR Score weights
          </Link>
          {config?.configured && missingComponentsWeighted && " — currently provisional: call quality and client representation have no real data source yet"}
        </p>

        <Board title="Close Rate" real={realRows} benchmarks={benchmarkRows} metric="closeRate" format={(v) => (v === null ? "—" : `${Math.round(v * 100)}%`)} />
        <Board title="Cash Collected" real={realRows} benchmarks={benchmarkRows} metric="cashCollected" format={(v) => money(v as number)} />
        <Board title="Commission Earned" real={realRows} benchmarks={benchmarkRows} metric="commissionEarned" format={(v) => money(v as number)} />
        <Board
          title="RR Score"
          real={realRows}
          benchmarks={benchmarkRows}
          metric="rrScore"
          format={(v) => (v === null ? "awaiting configuration" : `${v}${missingComponentsWeighted ? " (provisional)" : ""}`)}
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
