-- Real invoicing (P1): a client owing RR money gets an actual invoice
-- issued and sent from RR OS, not just a collection recorded after the
-- fact. Backed by real Stripe Invoices, emailed via our own Resend domain
-- so the client relationship stays inside RR OS instead of Stripe's UI.

alter table clients add column if not exists billing_email text;
alter table clients add column if not exists stripe_customer_id text;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  description text not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'usd',
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  due_date timestamptz,
  stripe_invoice_id text unique,
  hosted_invoice_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid references profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_set_updated_at before update on invoices
  for each row execute function set_updated_at();

alter table invoices enable row level security;

create policy founder_all_invoices on invoices for all using (private.auth_is_founder());
create policy client_scoped_invoices on invoices for select using (client_id in (select private.auth_client_ids()));
