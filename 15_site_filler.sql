-- =====================================================================
-- Vending CRM: database change 15 — an Assigned Filler for each site
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds one optional column to locations: the team member who looks after
-- the site. Every maintenance job at that site goes to them. It starts
-- empty for every site, so nothing existing changes. If that person is
-- ever removed, the site simply goes back to having nobody assigned.
-- The existing security rules already cover it: everyone can see it, and
-- only Administrators and Managers can change it.
-- =====================================================================

alter table locations
  add column assigned_to uuid references profiles(id) on delete set null;

create index on locations (assigned_to);
