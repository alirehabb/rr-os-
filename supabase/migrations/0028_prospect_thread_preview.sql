-- Cache of the most recent Instantly thread message per prospect, so the
-- unified inbox list can show a Gmail-style snippet without live-fetching
-- every prospect's thread on page load (would blow Instantly's 20 req/min
-- limit at any real prospect count). Written opportunistically whenever a
-- thread is actually fetched: a human opening it in the inbox, or the
-- follow-up engine pulling it for a cron run. Gets richer over time, never
-- requires its own dedicated fetch pass.
alter table prospects add column last_message_preview text;
alter table prospects add column last_message_at timestamptz;
