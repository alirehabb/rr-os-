-- Structured applicant fields (previously crammed into notes as free text)
-- so the Talent page can render every detail cleanly, plus a real flag for
-- "added to the free sales community waitlist" sent on rejection.
alter table reps
  add column if not exists phone text,
  add column if not exists linkedin_url text,
  add column if not exists resume_url text,
  add column if not exists sales_recording_url text,
  add column if not exists offer_text text,
  add column if not exists community_waitlist boolean not null default false;
