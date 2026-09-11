-- §21.2 — RR Score is a configured weighted combination. Until a human sets
-- weights, the score must show "awaiting configuration", never a fabricated
-- number. A single-row config table is enough since this is company-wide.

create table rr_score_config (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  weight_sales_performance numeric not null default 0,
  weight_follow_up_discipline numeric not null default 0,
  weight_call_quality numeric not null default 0,
  weight_client_representation numeric not null default 0,
  weight_consistency numeric not null default 0,
  configured boolean not null default false,
  configured_by uuid references profiles(id),
  configured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_set_updated_at before update on rr_score_config
  for each row execute function set_updated_at();

alter table rr_score_config enable row level security;

create policy founder_all_rr_score_config on rr_score_config for all using (private.auth_is_founder());

insert into rr_score_config (configured) values (false);
