-- Demo Data Mode: a clearly-labeled, toggleable, fully-purgeable set of
-- fictional records for experiencing the OS with populated screens. Never
-- mixed into real financial truth — aggregate/finance queries exclude
-- is_demo rows; list/detail screens show them with a visible "Demo" tag.

create table demo_mode (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into demo_mode (enabled) values (false);

alter table demo_mode enable row level security;
create policy founder_all_demo_mode on demo_mode for all using (private.auth_is_founder());

alter table clients add column is_demo boolean not null default false;
alter table reps add column is_demo boolean not null default false;
alter table opportunities add column is_demo boolean not null default false;
alter table calls add column is_demo boolean not null default false;
alter table deals add column is_demo boolean not null default false;
alter table collections add column is_demo boolean not null default false;
alter table action_items add column is_demo boolean not null default false;
alter table prospects add column is_demo boolean not null default false;
