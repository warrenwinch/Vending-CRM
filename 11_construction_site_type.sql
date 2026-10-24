-- =====================================================================
-- Vending CRM: database change 11 — "Construction" as a type of site
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- The list of site types is fixed in the database, so a new type has to
-- be added there too. Nothing existing changes.
-- =====================================================================

alter type location_type add value if not exists 'construction' before 'other';
