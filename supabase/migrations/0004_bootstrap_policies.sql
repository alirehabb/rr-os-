-- Let a signed-in user create their own profile row, and claim the founder
-- role only while no founder exists yet (single-founder bootstrap, §4).
-- The NOT EXISTS check is enforced in the database, not just app code, so a
-- second user can never self-grant founder after the first one exists.

create policy self_profile_insert on profiles for insert with check (id = auth.uid());

create policy bootstrap_founder_claim on user_roles for insert with check (
  user_id = auth.uid()
  and role = 'founder'
  and not exists (select 1 from user_roles where role = 'founder')
);
