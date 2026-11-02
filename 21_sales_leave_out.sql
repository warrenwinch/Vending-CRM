-- Vending CRM: database change 21 — leave a sales ID out of the totals
--
-- Some machines report to both Seed and Nayax, so their sales were counted
-- twice. A sales ID can now be marked "leave out", and its sales are kept
-- but not added into any totals.
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

alter table sales_links add column leave_out boolean not null default false;
