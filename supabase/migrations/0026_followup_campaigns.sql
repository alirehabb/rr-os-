-- Automated follow-up is now opt-in only: a founder either clicks "Follow
-- up now" on one prospect, or drags prospects into a campaign that then
-- runs the recurring automation for exactly those members. No more blind
-- sweeping every 'interested' prospect in the CRM.

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('instantly', 'sarah')),
  created_by uuid references profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table campaign_prospects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  prospect_id uuid not null references prospects(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  added_at timestamptz not null default now(),
  unique (campaign_id, prospect_id)
);

create index idx_campaign_prospects_campaign_id on campaign_prospects (campaign_id);
create index idx_campaign_prospects_prospect_id on campaign_prospects (prospect_id);

alter table campaigns enable row level security;
alter table campaign_prospects enable row level security;

create policy founder_all_campaigns on campaigns for all using (private.auth_is_founder());
create policy founder_all_campaign_prospects on campaign_prospects for all using (private.auth_is_founder());
