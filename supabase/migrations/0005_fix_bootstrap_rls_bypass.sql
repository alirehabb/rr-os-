-- Bug: the NOT EXISTS subquery inside bootstrap_founder_claim is itself
-- subject to RLS on user_roles, so a second user would only see their own
-- (empty) rows and could wrongly self-grant founder. Use a security-definer
-- function that bypasses RLS to check founder existence for real.

create or replace function private.any_founder_exists() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from user_roles where role = 'founder');
$$;

drop policy bootstrap_founder_claim on user_roles;

create policy bootstrap_founder_claim on user_roles for insert with check (
  user_id = auth.uid()
  and role = 'founder'
  and not private.any_founder_exists()
);
