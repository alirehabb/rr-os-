-- User management core (P0). A suspended account must not be able to use
-- the app at all — checked in middleware, not just hidden in the UI.
alter table profiles add column if not exists status text not null default 'active' check (status in ('active', 'suspended'));

-- Pending invitations. A candidate in Talent is never a user until someone
-- explicitly invites them here — Talent CRM and deployed system access are
-- deliberately separate tables with no automatic link.
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role app_role not null,
  client_id uuid references clients(id) on delete cascade,
  rep_id uuid references reps(id) on delete set null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days')
);

alter table invitations enable row level security;

create policy founder_all_invitations on invitations for all using (private.auth_is_founder());

-- No anon/authenticated select policy on purpose: the invite-acceptance
-- page (run before the invitee has a session) looks up its row through the
-- service-role client server-side, never through a browser-exposed query.
