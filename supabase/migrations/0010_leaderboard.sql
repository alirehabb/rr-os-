-- §21.1 — benchmark profiles must be clearly labeled hypothetical and
-- structurally excluded from finance, client reports, and real company
-- averages. A dedicated flag + static stats column keeps them out of any
-- query that aggregates real rep performance from ledger/opportunity data.

alter table reps add column is_benchmark boolean not null default false;
alter table reps add column benchmark_stats jsonb;

-- Seed clearly-labeled hypothetical profiles for leaderboard motivation (§21.1).
-- These carry no real user, no real client, no real money — benchmark_stats
-- is the only source of their numbers, never ledger/opportunity data.
insert into reps (full_name, email, capabilities, recruiting_status, is_benchmark, benchmark_stats)
values
  (
    'Benchmark: Elite Closer (hypothetical)',
    'benchmark-elite@example.invalid',
    array['closer'],
    'confirmed_active',
    true,
    jsonb_build_object('close_rate', 0.45, 'cash_collected', 85000, 'commission_earned', 12750, 'rr_score', null)
  ),
  (
    'Benchmark: Strong Performer (hypothetical)',
    'benchmark-strong@example.invalid',
    array['closer'],
    'confirmed_active',
    true,
    jsonb_build_object('close_rate', 0.30, 'cash_collected', 50000, 'commission_earned', 7500, 'rr_score', null)
  );
