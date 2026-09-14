-- Real knowledge system (P1): folders + typed items (doc/video/link/file/
-- image/template) + assignment to a rep, a role (broadcast), or a client,
-- with assigned/viewed/acknowledged tracking. Separate from the `documents`
-- table on purpose — that one is legal agreements/e-signature, this one is
-- the training/resource library.

create type knowledge_item_type as enum ('doc', 'video', 'link', 'file', 'image', 'template');

create table folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references folders(id) on delete cascade,
  name text not null,
  client_id uuid references clients(id) on delete cascade,
  created_by uuid references profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table knowledge_items (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references folders(id) on delete cascade,
  title text not null,
  type knowledge_item_type not null default 'doc',
  body text, -- markdown content, for type='doc'/'template'
  external_url text, -- for type='video'/'link'
  storage_path text, -- for type='file'/'image', object key in the "knowledge" bucket
  client_id uuid references clients(id) on delete cascade,
  created_by uuid references profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table knowledge_assignments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references knowledge_items(id) on delete cascade,
  rep_id uuid references reps(id) on delete cascade,
  role app_role,
  client_id uuid references clients(id) on delete cascade,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now(),
  viewed_at timestamptz,
  acknowledged_at timestamptz,
  is_demo boolean not null default false,
  constraint one_assignee check (
    (case when rep_id is not null then 1 else 0 end
     + case when role is not null then 1 else 0 end
     + case when client_id is not null then 1 else 0 end) = 1
  )
);

create trigger trg_set_updated_at before update on folders for each row execute function set_updated_at();
create trigger trg_set_updated_at before update on knowledge_items for each row execute function set_updated_at();

alter table folders enable row level security;
alter table knowledge_items enable row level security;
alter table knowledge_assignments enable row level security;

create policy founder_all_folders on folders for all using (private.auth_is_founder());
create policy founder_all_knowledge_items on knowledge_items for all using (private.auth_is_founder());
create policy founder_all_knowledge_assignments on knowledge_assignments for all using (private.auth_is_founder());

-- A client can browse folders/items scoped directly to their own account.
create policy client_scoped_folders on folders for select using (client_id in (select private.auth_client_ids()));
create policy client_scoped_knowledge_items on knowledge_items for select using (client_id in (select private.auth_client_ids()));

-- Anyone (rep by id, rep by role, or client) can see an item they were
-- actually assigned, and their own assignment row, and can update that row
-- to mark it viewed/acknowledged — never anyone else's.
create policy assigned_knowledge_items on knowledge_items for select using (
  id in (
    select item_id from knowledge_assignments
    where rep_id = private.auth_rep_id()
       or (role is not null and private.auth_has_role(role))
       or client_id in (select private.auth_client_ids())
  )
);

create policy own_knowledge_assignments on knowledge_assignments for select using (
  rep_id = private.auth_rep_id()
  or (role is not null and private.auth_has_role(role))
  or client_id in (select private.auth_client_ids())
);

create policy own_knowledge_assignments_update on knowledge_assignments for update using (
  rep_id = private.auth_rep_id()
  or (role is not null and private.auth_has_role(role))
  or client_id in (select private.auth_client_ids())
);
