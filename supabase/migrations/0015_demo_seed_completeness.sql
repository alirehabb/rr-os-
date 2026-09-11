-- Demo seed currently skips ledger/wallet/handover data, so Finance and the
-- Client 360 handover checklist look emptier under demo mode than real usage
-- would. Add is_demo to the two tables that were missing it so the fuller
-- seed can still be purged completely and distinctly from real records.

alter table ledger_entries add column is_demo boolean not null default false;
alter table wallet_entries add column is_demo boolean not null default false;
