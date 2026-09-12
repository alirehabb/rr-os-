import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getDemoMode } from "@/lib/demoMode";
import { PageHeader, SectionTitle, ProgressBar, Badge } from "@/components/ui";

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
  const demoMode = await getDemoMode(supabase);

  const [{ data: reps }, { data: opportunities }, { data: ledger }, { data: deals }, { data: collections }, { data: config }] =
    await Promise.all([
      // Benchmark rows are permanent hypothetical reference profiles
      // (is_demo=false always) — shown regardless of demo mode, clearly
      // labeled, never mixed into real totals.
      supabase.from("reps").select("id, full_name, is_benchmark, benchmark_stats").or(`is_benchmark.eq.true,is_demo.eq.${demoMode}`),
      supabase.from("opportunities").select("id, owner_rep_id, stage").eq("is_demo", demoMode),
      supabase.from("ledger_entries").select("rep_id, entry_type, amount").eq("is_demo", demoMode),
      supabase.from("deals").select("id, opportunity_id").eq("is_demo", demoMode),
      supabase.from("collections").select("deal_id, amount, status").eq("is_demo", demoMode),
      supabase.from("rr_score_config").select("*").limit(1).single(),
    ]);

  const nonTerminalOppIds = (opportunities ?? [])
    .filter((o) => o.stage !== "won" && o.stage !== "lost")
    .map((o) => o.id);
  const { data: nonTerminalCalls } = nonTerminalOppIds.length
    ? await supabase.from("calls").select("opportunity_id, agreed_next_action, scheduled_at").eq("is_demo", demoMode).in("opportunity_id", nonTerminalOppIds)
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
      <div className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          title="Leaderboard"
          subtitle="Benchmark rows are clearly labeled hypothetical profiles for motivation — they never count toward real company totals (§21.1)."
        />
        <p className="-mt-6 mb-8 text-xs text-faint">
          <Link href="/settings/rr-score" className="underline hover:text-muted">
            Configure RR Score weights
          </Link>
          {config?.configured && missingComponentsWeighted && " — currently provisional: call quality and client representation have no real data source yet"}
        </p>

        <Board title="Close Rate" real={realRows} benchmarks={benchmarkRows} metric="closeRate" format={(v) => (v === null ? "—" : `${Math.round(v * 100)}%`)} scaleMax={1} />
        <Board title="Cash Collected" real={realRows} benchmarks={benchmarkRows} metric="cashCollected" format={(v) => money(v as number)} />
        <Board title="Commission Earned" real={realRows} benchmarks={benchmarkRows} metric="commissionEarned" format={(v) => money(v as number)} />
        <Board
          title="RR Score"
          real={realRows}
          benchmarks={benchmarkRows}
          metric="rrScore"
          format={(v) => (v === null ? "awaiting configuration" : `${v}${missingComponentsWeighted ? " (provisional)" : ""}`)}
          scaleMax={100}
        />
      </div>
    </div>
  );
}

const RANK_STYLE = [
  { medal: "🥇", tone: "warning" as const, className: "border-warning/40 bg-warning-bg/50 shadow-[0_0_0_1px_rgba(234,179,8,0.15),0_4px_16px_-4px_rgba(234,179,8,0.35)]" },
  { medal: "🥈", tone: "neutral" as const, className: "border-border bg-surface-subtle" },
  { medal: "🥉", tone: "accent" as const, className: "border-accent/30 bg-accent/5" },
];

function Board({
  title,
  real,
  benchmarks,
  metric,
  format,
  scaleMax,
}: {
  title: string;
  real: RepRow[];
  benchmarks: RepRow[];
  metric: keyof RepRow;
  format: (v: number | null) => string;
  scaleMax?: number;
}) {
  const sorted = [...real].sort((a, b) => Number(b[metric] ?? -1) - Number(a[metric] ?? -1));
  const top = Number(sorted[0]?.[metric] ?? 0) || 1;

  return (
    <section className="mb-8">
      <SectionTitle>{title}</SectionTitle>
      <ul className="space-y-2">
        {sorted.map((r, i) => {
          const val = r[metric] as number | null;
          const pct = scaleMax ? ((val ?? 0) / scaleMax) * 100 : ((val ?? 0) / top) * 100;
          return (
            <li
              key={r.id}
              className={`rounded-2xl border p-3 shadow-sm shadow-black/[0.03] transition-transform ${
                i < 3 ? `${RANK_STYLE[i].className} hover:-translate-y-0.5` : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {i < 3 ? <span className="text-base">{RANK_STYLE[i].medal}</span> : <span className="text-faint">#{i + 1}</span>}
                  {r.fullName}
                </span>
                <span className="tabular-nums text-muted">{format(val)}</span>
              </div>
              {val !== null && (
                <div className="mt-2">
                  <ProgressBar value={pct} tone={i === 0 ? "success" : "accent"} />
                </div>
              )}
            </li>
          );
        })}
        {sorted.length === 0 && <li className="text-sm text-faint">No reps yet.</li>}
        {benchmarks.map((r) => (
          <li key={r.id} className="rounded-2xl border border-dashed border-warning/40 bg-warning-bg/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-warning">
                <Badge tone="warning">hypothetical</Badge>
                {r.fullName}
              </span>
              <span className="tabular-nums text-warning">{format(r[metric] as number | null)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
