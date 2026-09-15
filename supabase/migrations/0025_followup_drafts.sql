-- Daily CRM-driven follow-up: prospects.timezone (best-effort, nullable —
-- most cold leads never give us one) and last_ai_followup_at (once-a-day
-- dedupe, separate from qualification_notes so it can't be clobbered by an
-- Instantly sync). followup_drafts holds AI-drafted copy for any follow-up
-- that isn't going out through the fully-autonomous Instantly reply-in-
-- thread pipeline — external-channel leads and no-shows always get a human
-- review step before anything sends.

alter table prospects add column if not exists timezone text;
alter table prospects add column if not exists last_ai_followup_at timestamptz;

create table followup_drafts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  channel text not null check (channel in ('external', 'no_show')),
  subject text not null,
  body text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'sent', 'dismissed')),
  sent_at timestamptz,
  sent_by uuid references profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_followup_drafts_prospect_id on followup_drafts (prospect_id);

alter table followup_drafts enable row level security;

create policy founder_all_followup_drafts on followup_drafts for all using (private.auth_is_founder());
