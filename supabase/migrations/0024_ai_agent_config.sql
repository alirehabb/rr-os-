-- AI reply agent for Instantly interest replies. Single-row config, same
-- pattern as rr_score_config: tone/guidelines/knowledge_base are set by the
-- founder in Settings, auto_reply_enabled defaults false and stays false
-- until a human explicitly turns it on — never auto-send with unset
-- guidelines.

create table ai_agent_config (
  id uuid primary key default gen_random_uuid(),
  tone text,
  guidelines text,
  knowledge_base text,
  auto_reply_enabled boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create trigger trg_set_updated_at before update on ai_agent_config
  for each row execute function set_updated_at();

alter table ai_agent_config enable row level security;

create policy founder_all_ai_agent_config on ai_agent_config for all using (private.auth_is_founder());

insert into ai_agent_config (auto_reply_enabled) values (false);
