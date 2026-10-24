-- =====================================================================
-- Vending CRM: database change 10 — archiving customers
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds one empty, optional field to each customer (stored in the
-- "clients" table): the date it was archived. Archived customers are
-- hidden from lists in the app but nothing is deleted. The existing
-- security rules already cover it.
-- =====================================================================

alter table clients add column archived_at timestamptz;
