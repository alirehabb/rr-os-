-- In-house e-signature: no DocuSign/Zoho API needed. The founder writes a
-- plain-text contract template with placeholders, sends a link, the
-- counterparty types their name to sign. This replaces the old
-- "attach an executed copy link" manual-only flow with a real capture of
-- who signed what and when, while still not requiring any external API.

alter table documents add column body_template text;
alter table documents add column rendered_body text;

create table document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  signer_name text not null,
  signer_title text,
  signed_at timestamptz not null default now(),
  ip_address text
);

alter table document_signatures enable row level security;

create policy founder_all_document_signatures on document_signatures for all using (private.auth_is_founder());
