-- Wrap auth.uid() as (select auth.uid()) so Postgres evaluates it once per
-- query instead of once per row (Supabase perf advisor 0003).

create or replace function private.auth_has_role(check_role app_role) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from user_roles where user_id = (select auth.uid()) and role = check_role);
$$;

create or replace function private.auth_client_ids() returns setof uuid
  language sql security definer stable set search_path = public as $$
  select client_id from user_roles where user_id = (select auth.uid()) and client_id is not null;
$$;

create or replace function private.auth_rep_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select id from reps where profile_id = (select auth.uid()) limit 1;
$$;

drop policy self_profile on profiles;
drop policy self_profile_update on profiles;
drop policy self_profile_insert on profiles;
drop policy self_user_roles on user_roles;
drop policy own_action_items on action_items;
drop policy own_action_items_update on action_items;
drop policy rep_own_reps_row on reps;
drop policy bootstrap_founder_claim on user_roles;

create policy self_profile on profiles for select using (id = (select auth.uid()));
create policy self_profile_update on profiles for update using (id = (select auth.uid()));
create policy self_profile_insert on profiles for insert with check (id = (select auth.uid()));
create policy self_user_roles on user_roles for select using (user_id = (select auth.uid()));
create policy own_action_items on action_items for select using (owner_id = (select auth.uid()));
create policy own_action_items_update on action_items for update using (owner_id = (select auth.uid()));
create policy rep_own_reps_row on reps for select using (profile_id = (select auth.uid()));

create policy bootstrap_founder_claim on user_roles for insert with check (
  user_id = (select auth.uid())
  and role = 'founder'
  and not private.any_founder_exists()
);
