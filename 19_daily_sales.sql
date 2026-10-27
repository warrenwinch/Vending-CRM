-- =====================================================================
-- Vending CRM: database change 19 — daily sales totals
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds one new table. Nothing existing changes.
--   daily_sales  one row per system per day: units and dollars (all machines
--                added together), for Yesterday, Week to date and the
--                month-to-date chart on Home. Machine-by-machine figures stay
--                monthly in machine_sales.
-- Only Administrators and Managers can see or change it. Importing a day
-- again replaces that day for that system (never doubles).
-- =====================================================================

create table daily_sales (
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  source            text not null check (source in ('seed_vending', 'seed_market', 'nayax')),
  day               date not null,
  units             integer not null default 0,
  amount            numeric(12,2) not null,
  imported_at       timestamptz not null default now(),
  primary key (organization_id, source, day)
);

alter table daily_sales enable row level security;

create policy daily_sales_office on daily_sales for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));
