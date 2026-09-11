-- RR's own acquisition CRM (§7) — separate from client fulfillment and from
-- client buyers' opportunities. Signing links to a single Client 360 (§7, §8.1).

create type prospect_stage as enum (
  'lead', 'interested', 'call_booked', 'call_completed', 'follow_up',
  'agreement_sent', 'signed', 'no_show', 'not_fit'
);

create table prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  source text, -- 'website' | 'instantly' | 'calendly' | 'manual'
  stage prospect_stage not null default 'lead',
  qualification_notes text,
  proposed_plan text,
  next_action text,
  next_action_date timestamptz,
  owner_id uuid references profiles(id),
  converted_client_id uuid references clients(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_set_updated_at before update on prospects
  for each row execute function set_updated_at();

alter table prospects enable row level security;

create policy founder_all_prospects on prospects for all using (private.auth_is_founder());
