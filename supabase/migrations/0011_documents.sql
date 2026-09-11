-- §16 — Documents workflow: template → draft → reviewed → sent for signature
-- → executed copy → structured terms → approval → Finance/Client config.
-- No e-sign provider is connected tonight, so "sent for signature" and
-- "executed" are human-attested states with an evidence link, clearly
-- distinguished from an automated provider integration (§3 manual fallback).

create table documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  rep_assignment_id uuid references rep_assignments(id) on delete cascade,
  doc_type text not null check (doc_type in ('agreement', 'training', 'other')),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'sent_for_signature', 'executed')),
  executed_copy_url text,
  effective_date timestamptz,
  structured_terms jsonb,
  terms_approved boolean not null default false,
  terms_approved_by uuid references profiles(id),
  terms_approved_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_set_updated_at before update on documents
  for each row execute function set_updated_at();

alter table documents enable row level security;

create policy founder_all_documents on documents for all using (private.auth_is_founder());

create policy client_scoped_documents on documents for select using (
  client_id in (select private.auth_client_ids())
);
