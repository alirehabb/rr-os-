-- §17.3 — store the report snapshot, source period, recipients, and delivery
-- status so a sent report is reviewable and re-sendable, not regenerated
-- silently from possibly-changed underlying data.

create table client_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  snapshot jsonb not null,
  recipient_emails text[] not null default '{}',
  delivery_status text not null default 'draft' check (delivery_status in ('draft', 'sent', 'failed')),
  sent_at timestamptz,
  sent_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table client_reports enable row level security;

create policy founder_all_client_reports on client_reports for all using (private.auth_is_founder());

create policy client_scoped_client_reports on client_reports for select using (
  client_id in (select private.auth_client_ids()) and delivery_status = 'sent'
);
