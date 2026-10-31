-- Vending CRM: database change 20 — commission for a whole customer
--
-- Seed's commission summary gives one figure per customer, not per site.
-- A payment line can now leave the site empty, meaning "the whole customer".
-- Payments recorded by hand still name their sites as before.
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

alter table commission_payment_lines alter column location_id drop not null;
