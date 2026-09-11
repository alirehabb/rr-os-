-- §17.1 — contextual internal communication attached to a Client, Rep,
-- Opportunity, Call, or Action Item. Internal notes must never leak into
-- client reports or rep views, so this stays founder/internal-team scoped
-- (no client-portal visibility exists yet — §4 tonight scope).

create table communications (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('client', 'rep', 'opportunity', 'call', 'action_item')),
  subject_id uuid not null,
  client_id uuid references clients(id), -- denormalized for client-scoped RLS without a polymorphic join
  body text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'client', 'rep')),
  author_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index communications_subject_idx on communications (subject_type, subject_id);

alter table communications enable row level security;

create policy founder_all_communications on communications for all using (private.auth_is_founder());

create policy client_scoped_communications on communications for select using (
  client_id in (select private.auth_client_ids()) and visibility != 'internal'
);

create policy author_insert_communications on communications for insert with check (
  author_id = (select auth.uid())
);
