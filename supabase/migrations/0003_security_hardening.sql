-- Fix advisor findings without breaking RLS:
-- - move auth helper functions into a "private" schema (PostgREST only exposes "public",
--   so this removes anon/authenticated RPC exposure without revoking the EXECUTE grant
--   policies themselves need)
-- - pin search_path on every function
-- - make the two views security_invoker so they respect the querying user's RLS

create schema if not exists private;

create or replace function private.auth_has_role(check_role app_role) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = check_role);
$$;

create or replace function private.auth_is_founder() returns boolean
  language sql security definer stable set search_path = public as $$
  select private.auth_has_role('founder');
$$;

create or replace function private.auth_client_ids() returns setof uuid
  language sql security definer stable set search_path = public as $$
  select client_id from user_roles where user_id = auth.uid() and client_id is not null;
$$;

create or replace function private.auth_rep_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select id from reps where profile_id = auth.uid() limit 1;
$$;

create or replace function public.set_updated_at() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Repoint every policy at the private.* versions, then drop the old public ones.
drop policy founder_all_profiles on profiles;
drop policy founder_all_user_roles on user_roles;
drop policy founder_all_clients on clients;
drop policy founder_all_handover on handover_items;
drop policy founder_all_connections on connections;
drop policy founder_all_reps on reps;
drop policy founder_all_rep_assignments on rep_assignments;
drop policy founder_all_opportunities on opportunities;
drop policy founder_all_ownership_history on opportunity_ownership_history;
drop policy founder_all_calls on calls;
drop policy founder_all_deals on deals;
drop policy founder_all_collections on collections;
drop policy founder_all_ledger on ledger_entries;
drop policy founder_all_wallet on wallet_entries;
drop policy founder_all_actions on action_items;
drop policy founder_all_audit on audit_log;
drop policy client_scoped_clients on clients;
drop policy client_scoped_handover on handover_items;
drop policy client_scoped_connections on connections;
drop policy client_scoped_rep_assignments on rep_assignments;
drop policy client_scoped_opportunities on opportunities;
drop policy rep_own_opportunities on opportunities;
drop policy rep_own_opportunities_update on opportunities;
drop policy rep_own_calls on calls;
drop policy rep_own_calls_write on calls;
drop policy rep_own_calls_update on calls;
drop policy rep_own_wallet on wallet_entries;
drop policy rep_own_reps_row on reps;

create policy founder_all_profiles on profiles for all using (private.auth_is_founder());
create policy founder_all_user_roles on user_roles for all using (private.auth_is_founder());
create policy founder_all_clients on clients for all using (private.auth_is_founder());
create policy founder_all_handover on handover_items for all using (private.auth_is_founder());
create policy founder_all_connections on connections for all using (private.auth_is_founder());
create policy founder_all_reps on reps for all using (private.auth_is_founder());
create policy founder_all_rep_assignments on rep_assignments for all using (private.auth_is_founder());
create policy founder_all_opportunities on opportunities for all using (private.auth_is_founder());
create policy founder_all_ownership_history on opportunity_ownership_history for all using (private.auth_is_founder());
create policy founder_all_calls on calls for all using (private.auth_is_founder());
create policy founder_all_deals on deals for all using (private.auth_is_founder());
create policy founder_all_collections on collections for all using (private.auth_is_founder());
create policy founder_all_ledger on ledger_entries for all using (private.auth_is_founder());
create policy founder_all_wallet on wallet_entries for all using (private.auth_is_founder());
create policy founder_all_actions on action_items for all using (private.auth_is_founder());
create policy founder_all_audit on audit_log for all using (private.auth_is_founder());

create policy client_scoped_clients on clients for select using (id in (select private.auth_client_ids()));
create policy client_scoped_handover on handover_items for select using (client_id in (select private.auth_client_ids()));
create policy client_scoped_connections on connections for select using (client_id in (select private.auth_client_ids()));
create policy client_scoped_rep_assignments on rep_assignments for select using (client_id in (select private.auth_client_ids()));
create policy client_scoped_opportunities on opportunities for select using (client_id in (select private.auth_client_ids()));

create policy rep_own_opportunities on opportunities for select using (
  owner_rep_id = private.auth_rep_id() or setter_rep_id = private.auth_rep_id()
);
create policy rep_own_opportunities_update on opportunities for update using (
  owner_rep_id = private.auth_rep_id()
);
create policy rep_own_calls on calls for select using (
  opportunity_id in (select id from opportunities where owner_rep_id = private.auth_rep_id() or setter_rep_id = private.auth_rep_id())
);
create policy rep_own_calls_write on calls for insert with check (
  opportunity_id in (select id from opportunities where owner_rep_id = private.auth_rep_id())
);
create policy rep_own_calls_update on calls for update using (
  opportunity_id in (select id from opportunities where owner_rep_id = private.auth_rep_id())
);

create policy rep_own_wallet on wallet_entries for select using (rep_id = private.auth_rep_id());
create policy rep_own_reps_row on reps for select using (profile_id = auth.uid());

-- Drop the now-unused public copies (no longer referenced by any policy).
drop function if exists public.auth_has_role(app_role);
drop function if exists public.auth_is_founder();
drop function if exists public.auth_client_ids();
drop function if exists public.auth_rep_id();

alter view client_clocks set (security_invoker = on);
alter view rep_trial_clocks set (security_invoker = on);
