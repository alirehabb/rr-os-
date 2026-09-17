-- Separate switch for the proactive follow-up cron from the reactive reply
-- agent's auto_reply_enabled. The founder wants auto-reply to keep running
-- (it's gated per-thread already) but wants automated follow-up sends
-- paused while a safer approach is worked out. Defaults false so the cron
-- is a no-op until explicitly re-enabled from Settings.
alter table ai_agent_config add column auto_followup_enabled boolean not null default false;
