-- =====================================================================
-- Vending CRM: database change 24 — machines filled on each driver's run
-- Run once in Supabase, after 23: SQL Editor > New query > paste all > Run
--
-- Adds one new table. No existing table changes.
--   stock_run_machines  one row per machine a driver filled on a run
-- The import step from change 23 is replaced by one that saves this too, all
-- or nothing. Only Administrators and Managers can see or change these.
-- Runs imported before this have no machines filled until imported again.
-- =====================================================================

create table stock_run_machines (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  ticket_date       date not null,
  driver_name       text not null check (length(trim(driver_name)) between 2 and 100),
  external_id       text not null check (length(external_id) between 1 and 200),  -- Seed's Asset ID
  units_filled      integer not null check (units_filled > 0),
  imported_at       timestamptz not null default now(),
  imported_by       uuid default auth.uid() references profiles(id) on delete set null
);
create index on stock_run_machines (organization_id, ticket_date desc);
create index on stock_run_machines (organization_id, lower(driver_name), ticket_date);

alter table stock_run_machines enable row level security;

create policy stock_run_machines_office on stock_run_machines for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

drop function public.import_stock_variances(date, text, jsonb);

-- Saves one driver's report for one date: removes that run's old rows and adds
-- the new ones, all or nothing. Empty lists just remove the run. Returns rows saved.
-- p_rows is a list of {external_id, coil, item_code, item_name, observed, variance}.
-- p_machines is a list of {external_id, units_filled}.
create function public.import_stock_variances(p_date date, p_driver text, p_rows jsonb, p_machines jsonb)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  saved integer;
begin
  if public.current_user_role() not in ('administrator','manager') then
    raise exception 'Only Administrators and Managers can import stock variances.';
  end if;
  if p_date is null then raise exception 'Please choose the date of the run.'; end if;
  p_driver := trim(coalesce(p_driver, ''));
  if length(p_driver) < 2 then raise exception 'Please enter the driver.'; end if;

  delete from stock_variances
    where organization_id = public.current_org_id() and ticket_date = p_date and lower(driver_name) = lower(p_driver);
  delete from stock_run_machines
    where organization_id = public.current_org_id() and ticket_date = p_date and lower(driver_name) = lower(p_driver);

  insert into stock_variances (ticket_date, driver_name, external_id, coil, item_code, item_name, observed, variance)
  select p_date, p_driver, r.external_id, r.coil, r.item_code, r.item_name, r.observed, r.variance
  from jsonb_to_recordset(p_rows) as r(
    external_id text, coil text, item_code text, item_name text, observed integer, variance integer);
  get diagnostics saved = row_count;

  insert into stock_run_machines (ticket_date, driver_name, external_id, units_filled)
  select p_date, p_driver, m.external_id, m.units_filled
  from jsonb_to_recordset(p_machines) as m(external_id text, units_filled integer);

  return saved;
end $$;

revoke all on function public.import_stock_variances(date, text, jsonb, jsonb) from public;
grant execute on function public.import_stock_variances(date, text, jsonb, jsonb) to authenticated;
