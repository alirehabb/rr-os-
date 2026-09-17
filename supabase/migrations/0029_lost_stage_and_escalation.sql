-- "Lost" is the CRM's own negative pipeline stage for a prospect who
-- explicitly declined or went dead, distinct from "not_fit" (never
-- qualified in the first place). Both are dead ends the agent must never
-- touch again.
alter type prospect_stage add value if not exists 'lost';

-- The agent's human-interference gate: set when a reply suggests specific
-- times instead of using the booking link, or is otherwise ambiguous. The
-- agent stops touching the thread and a founder email goes out; a human
-- clears the flag once they've handled it.
alter table prospects add column needs_human_review boolean not null default false;
alter table prospects add column human_review_reason text;
