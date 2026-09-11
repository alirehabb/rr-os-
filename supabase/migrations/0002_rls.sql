-- Role- and account-scoped access (§4, §20). Enforced on actual rows, not just navigation.

create or replace function auth_has_role(check_role app_role) returns boolean as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = check_role
  );
$$ language sql security definer stable;

create or replace function auth_is_founder() returns boolean as $$
  select auth_has_role('founder');
$$ language sql security definer stable;

create or replace function auth_client_ids() returns setof uuid as $$
  select client_id from user_roles where user_id = auth.uid() and client_id is not null;
$$ language sql security definer stable;

create or replace function auth_rep_id() returns uuid as $$
  select id from reps where profile_id = auth.uid() limit 1;
$$ language sql security definer stable;

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table clients enable row level security;
alter table handover_items enable row level security;
alter table connections enable row level security;
alter table reps enable row level security;
alter table rep_assignments enable row level security;
alter table opportunities enable row level security;
alter table opportunity_ownership_history enable row level security;
alter table calls enable row level security;
alter table deals enable row level security;
alter table collections enable row level security;
alter table ledger_entries enable row level security;
alter table wallet_entries enable row level security;
alter table action_items enable row level security;
alter table audit_log enable row level security;

-- Founder: full access everywhere
create policy founder_all_profiles on profiles for all using (auth_is_founder());
create policy founder_all_user_roles on user_roles for all using (auth_is_founder());
create policy founder_all_clients on clients for all using (auth_is_founder());
create policy founder_all_handover on handover_items for all using (auth_is_founder());
create policy founder_all_connections on connections for all using (auth_is_founder());
create policy founder_all_reps on reps for all using (auth_is_founder());
create policy founder_all_rep_assignments on rep_assignments for all using (auth_is_founder());
create policy founder_all_opportunities on opportunities for all using (auth_is_founder());
create policy founder_all_ownership_history on opportunity_ownership_history for all using (auth_is_founder());
create policy founder_all_calls on calls for all using (auth_is_founder());
create policy founder_all_deals on deals for all using (auth_is_founder());
create policy founder_all_collections on collections for all using (auth_is_founder());
create policy founder_all_ledger on ledger_entries for all using (auth_is_founder());
create policy founder_all_wallet on wallet_entries for all using (auth_is_founder());
create policy founder_all_actions on action_items for all using (auth_is_founder());
create policy founder_all_audit on audit_log for all using (auth_is_founder());

-- Every authenticated user can read/update their own profile
create policy self_profile on profiles for select using (id = auth.uid());
create policy self_profile_update on profiles for update using (id = auth.uid());
create policy self_user_roles on user_roles for select using (user_id = auth.uid());

-- Client-scoped roles (internal/closer/setter/finance assigned to a client) can see that client's records
create policy client_scoped_clients on clients for select using (id in (select auth_client_ids()));
create policy client_scoped_handover on handover_items for select using (client_id in (select auth_client_ids()));
create policy client_scoped_connections on connections for select using (client_id in (select auth_client_ids()));
create policy client_scoped_rep_assignments on rep_assignments for select using (client_id in (select auth_client_ids()));
create policy client_scoped_opportunities on opportunities for select using (client_id in (select auth_client_ids()));

-- Reps: see only their own opportunities (owner or setter credit), never another rep's
create policy rep_own_opportunities on opportunities for select using (
  owner_rep_id = auth_rep_id() or setter_rep_id = auth_rep_id()
);
create policy rep_own_opportunities_update on opportunities for update using (
  owner_rep_id = auth_rep_id()
);
create policy rep_own_calls on calls for select using (
  opportunity_id in (select id from opportunities where owner_rep_id = auth_rep_id() or setter_rep_id = auth_rep_id())
);
create policy rep_own_calls_write on calls for insert with check (
  opportunity_id in (select id from opportunities where owner_rep_id = auth_rep_id())
);
create policy rep_own_calls_update on calls for update using (
  opportunity_id in (select id from opportunities where owner_rep_id = auth_rep_id())
);

-- Reps: own wallet only, never another rep's payout details (§15.3, §20)
create policy rep_own_wallet on wallet_entries for select using (rep_id = auth_rep_id());
create policy rep_own_reps_row on reps for select using (profile_id = auth.uid());

-- Action items: visible to their owner
create policy own_action_items on action_items for select using (owner_id = auth.uid());
create policy own_action_items_update on action_items for update using (owner_id = auth.uid());
