-- §6.1 Founder Progress needs a real configured target, never invented.
create table founder_targets (
  id uuid primary key default gen_random_uuid(),
  monthly_revenue_target numeric,
  deals_target int,
  new_clients_target int,
  updated_at timestamptz not null default now()
);
insert into founder_targets (monthly_revenue_target, deals_target, new_clients_target) values (null, null, null);

alter table founder_targets enable row level security;
create policy founder_all_founder_targets on founder_targets for all using (private.auth_is_founder());
