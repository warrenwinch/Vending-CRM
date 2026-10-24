-- =====================================================================
-- Vending CRM: database change 11 — more types of site
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds Construction, Club and Pub. The list of site types is fixed in the
-- database, so new types have to be added there too. Nothing existing
-- changes.
-- =====================================================================

alter type location_type add value if not exists 'construction' before 'other';
alter type location_type add value if not exists 'club' before 'other';
alter type location_type add value if not exists 'pub' before 'other';
