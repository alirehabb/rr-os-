-- Rehab Revenue OS — core schema (spec v1.0 §5)
-- Product concepts, not a full implementation of every later section.
-- All money/state-changing tables carry created_at/updated_at + actor for auditability (§5, §20).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Roles & identity (§4)
-- ─────────────────────────────────────────────────────────────────────────

create type app_role as enum ('founder', 'internal', 'closer', 'setter', 'finance', 'client');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role app_role not null,
  -- scoped to a specific client account when the role is client-facing (closer/setter/client/finance-for-client)
  client_id uuid, -- fk added after clients table exists
  created_at timestamptz not null default now(),
  unique (user_id, role, client_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Client 360 (§9) + lifecycle (§8)
-- ─────────────────────────────────────────────────────────────────────────

create type client_lifecycle_state as enum (
  'onboarding', 'access_pending', 'fulfillment', 'rep_training_trial',
  'live', 'active', 'paused', 'churned'
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lifecycle_state client_lifecycle_state not null default 'onboarding',
  workflow_type text not null default 'closing_only', -- 'closing_only' | 'azgari' | 'setting_enabled' | custom label
  signed_at timestamptz, -- starts both §8.3 clocks; deadlines computed in app/views as signed_at + 48h / +7d
  fulfillment_completed_at timestamptz,
  go_live_completed_at timestamptz,
  rr_rate_basis jsonb, -- approved commission terms (§15.2); null = "not configured", never fabricated
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_roles add constraint user_roles_client_fk foreign key (client_id) references clients(id) on delete cascade;

-- Complete Sales Handover checklist items (§8.2)
create table handover_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  category text not null, -- offer_economics | buyer_qualification | sales_journey | history | sales_resources | delivery_context | operational_access | commercial_relationship
  label text not null,
  status text not null default 'missing' check (status in ('missing', 'submitted', 'verified', 'not_applicable')),
  not_applicable_reason text,
  owner text not null default 'client' check (owner in ('client', 'rr')),
  due_at timestamptz,
  evidence_url text,
  blocks_readiness boolean not null default true,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Access connections (§19) — status must reflect real provider state, never fabricated "connected"
create table connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade, -- null = RR-wide connection (e.g. Resend)
  provider text not null, -- 'calendly' | 'resend' | 'slack' | 'google_calendar' | 'stripe' | 'docusign' | etc.
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'degraded', 'access_pending')),
  authorized_account text,
  access_level text,
  owner_id uuid references profiles(id),
  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Sales Talent / Rep 360 (§10)
-- ─────────────────────────────────────────────────────────────────────────

create type recruiting_status as enum (
  'application', 'screening', 'interview', 'talent_pool', 'rejected',
  'available_for_matching', 'selected', 'client_training', 'live_trial',
  'confirmed_active', 'bench', 'removed'
);

create table reps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id), -- null until they have platform login
  full_name text not null,
  email text not null,
  recruiting_status recruiting_status not null default 'application',
  capabilities text[] not null default '{}', -- 'closer' | 'setter'
  geography text,
  timezone text,
  intro_loom_url text,
  claimed_cash_collected numeric,
  verified_cash_collected numeric,
  evidence_source text,
  notes text, -- private internal notes (§20 restricted visibility)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Job-relevant factors only — race/ethnicity are never collected (§10.2, hard constraint)
create table rep_assignments (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references reps(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  role text not null check (role in ('closer', 'setter')),
  booking_link text, -- client-specific booking link (§11.2)
  status text not null default 'selected' check (status in ('selected', 'training', 'trial', 'active', 'bench', 'removed')),
  trial_started_at timestamptz, -- trial begins at first live work, not signature (§8.3); review due = +7d, computed in app/views
  trial_review_result text,
  trial_reviewed_at timestamptz,
  compensation_terms jsonb, -- approved basis/rate (§15.2); null = not configured
  active_from timestamptz,
  removed_at timestamptz,
  removed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rep_id, client_id, role)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Opportunity 360 (§11) — a booked sales call, not an unbooked lead
-- ─────────────────────────────────────────────────────────────────────────

create type opportunity_stage as enum ('upstream', 'booked', 'follow_up', 'won', 'lost');

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  prospect_name text not null,
  prospect_contact text,
  source text,
  setter_rep_id uuid references reps(id), -- upstream credit, does not confer ownership
  owner_rep_id uuid references reps(id), -- current closer owner
  stage opportunity_stage not null default 'booked',
  custom_stage_label text, -- client-specific label, maps to universal stage above (§9.1)
  first_booked_at timestamptz not null default now(),
  value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table opportunity_ownership_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  from_rep_id uuid references reps(id),
  to_rep_id uuid references reps(id),
  changed_by uuid references profiles(id),
  reason text not null,
  created_at timestamptz not null default now()
);

-- Meeting / Call Record (§12) — mandatory: recording + transcript + notes + outcome + next step + value + payment
create type call_outcome as enum (
  'completed_won', 'completed_follow_up', 'completed_lost', 'no_show', 'cancelled', 'rescheduled', 'pending'
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  scheduled_at timestamptz not null,
  external_event_id text, -- Calendly event id, for dedup on replayed webhooks (§11.3)
  outcome call_outcome not null default 'pending',
  notes text,
  recording_status text not null default 'unavailable' check (recording_status in ('pending', 'available', 'failed', 'unavailable')),
  recording_url text,
  transcript_status text not null default 'unavailable' check (transcript_status in ('pending', 'available', 'failed', 'unavailable')),
  transcript_url text,
  agreed_next_action text,
  next_call_at timestamptz,
  deal_value numeric,
  logged_by uuid references profiles(id),
  logged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_event_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Finance ledger & Rep Wallet (§15) — full traceability, no autonomous money movement
-- ─────────────────────────────────────────────────────────────────────────

create table deals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  value numeric not null,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  amount numeric not null,
  currency text not null default 'USD',
  status text not null default 'reported' check (status in ('reported', 'verified', 'disputed', 'refunded')),
  reported_by uuid references profiles(id),
  reported_at timestamptz not null default now(),
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  client_id uuid not null references clients(id),
  entry_type text not null check (entry_type in (
    'rr_receivable', 'rr_received', 'rep_commission_earned', 'rep_payable', 'adjustment', 'refund', 'chargeback'
  )),
  amount numeric not null,
  currency text not null default 'USD',
  rep_id uuid references reps(id),
  effective_terms jsonb, -- snapshot of the terms used, so contract changes never rewrite settled history (§15.2)
  linked_adjustment_of uuid references ledger_entries(id), -- refunds/chargebacks link rather than delete
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create table wallet_entries (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references reps(id) on delete cascade,
  ledger_entry_id uuid references ledger_entries(id),
  amount numeric not null,
  status text not null default 'earned' check (status in ('earned', 'pending_client_payment', 'payable', 'approved', 'paid', 'failed')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Action Items / Command Queue (§6.3)
-- ─────────────────────────────────────────────────────────────────────────

create type action_status as enum ('open', 'in_progress', 'waiting', 'done', 'snoozed', 'cancelled');

create table action_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reason text not null,
  status action_status not null default 'open',
  owner_id uuid references profiles(id),
  waiting_on text, -- required if status = 'waiting'
  snoozed_until timestamptz, -- required if status = 'snoozed'
  priority int not null default 0, -- higher = more urgent; founder can pin/override
  pinned boolean not null default false,
  deadline_at timestamptz,
  money_impact numeric, -- null = unknown, must render as "unknown" not zero (§6.3)
  client_id uuid references clients(id),
  opportunity_id uuid references opportunities(id),
  rep_id uuid references reps(id),
  related_record_type text,
  related_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────
-- Audit log (§20) — hiring/placement, ownership, terms, approvals, finance, comms, automation
-- ─────────────────────────────────────────────────────────────────────────

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  actor_type text not null default 'human' check (actor_type in ('human', 'automation')),
  action text not null,
  target_type text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','clients','handover_items','connections','reps','rep_assignments',
    'opportunities','calls','deals','collections','wallet_entries','action_items'
  ] loop
    execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Views for computed clocks (§8.3) — kept out of stored columns since
-- timestamptz arithmetic is not immutable
-- ─────────────────────────────────────────────────────────────────────────

create view client_clocks as
select
  id as client_id,
  signed_at,
  signed_at + interval '48 hours' as fulfillment_deadline,
  signed_at + interval '7 days' as go_live_deadline,
  fulfillment_completed_at,
  go_live_completed_at,
  (fulfillment_completed_at is null and signed_at is not null and now() > signed_at + interval '48 hours') as fulfillment_breached,
  (go_live_completed_at is null and signed_at is not null and now() > signed_at + interval '7 days') as go_live_breached
from clients;

create view rep_trial_clocks as
select
  id as rep_assignment_id,
  rep_id,
  client_id,
  trial_started_at,
  trial_started_at + interval '7 days' as trial_review_due_at,
  trial_reviewed_at,
  (trial_reviewed_at is null and trial_started_at is not null and now() > trial_started_at + interval '7 days') as trial_review_overdue
from rep_assignments;
