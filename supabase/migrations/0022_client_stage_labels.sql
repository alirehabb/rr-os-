-- Client-specific workflow layer (§4): the universal pipeline (booked ->
-- follow_up -> won/lost) never changes — automation and reporting stay
-- correct — but each client can give those universal stages their own
-- vocabulary. Azgari can call "booked" a "Candidate Introduced" without
-- opportunities.stage ever meaning anything different underneath.
create table client_stage_labels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  stage opportunity_stage not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, stage)
);

create trigger trg_set_updated_at before update on client_stage_labels
  for each row execute function set_updated_at();

alter table client_stage_labels enable row level security;

create policy founder_all_client_stage_labels on client_stage_labels for all using (private.auth_is_founder());
create policy client_scoped_stage_labels on client_stage_labels for select using (client_id in (select private.auth_client_ids()));
