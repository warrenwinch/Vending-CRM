-- =====================================================================
-- Vending CRM: database change 2 — where inside a site a machine sits
-- Run once in Supabase: SQL Editor > New query > paste all > Run
-- Adds an optional "position" to each placement, e.g. "Level 4N, by the lifts".
-- Nothing existing is changed; the security rules already cover this column.
-- =====================================================================

alter table machine_placements
  add column position text check (position is null or length(position) <= 200);
