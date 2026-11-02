-- =====================================================================
-- Vending CRM: database change 23 — stock variances from Seed's cash tickets
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds one new table. Nothing existing changes.
--   stock_variances  one row per coil a driver counted on a run: what they
--                    counted, and how far that was from what Seed expected
-- Seed's report doesn't say who or when, so the driver and date are chosen
-- when it's imported. Only Administrators and Managers can see or change
-- these. Importing the same driver and date again replaces that run (never
-- doubles).
-- =====================================================================

create table stock_variances (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  ticket_date       date not null,
  driver_name       text not null check (length(trim(driver_name)) between 2 and 100),
  external_id       text not null check (length(external_id) between 1 and 200),  -- Seed's Asset ID
  coil              text check (coil is null or length(coil) <= 50),
  item_code         text check (item_code is null or length(item_code) <= 100),
  item_name         text check (item_name is null or length(item_name) <= 300),
  observed          integer not null,
  variance          integer not null,
  imported_at       timestamptz not null default now(),
  imported_by       uuid default auth.uid() references profiles(id) on delete set null
);
create index on stock_variances (organization_id, ticket_date desc);
create index on stock_variances (organization_id, lower(driver_name), ticket_date);

alter table stock_variances enable row level security;

create policy stock_variances_office on stock_variances for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

-- Saves one driver's report for one date: removes that run's old rows and adds
-- the new ones, all or nothing. Returns rows saved.
-- p_rows is a list of {external_id, coil, item_code, item_name, observed, variance}.
create function public.import_stock_variances(p_date date, p_driver text, p_rows jsonb)
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

  insert into stock_variances (ticket_date, driver_name, external_id, coil, item_code, item_name, observed, variance)
  select p_date, p_driver, r.external_id, r.coil, r.item_code, r.item_name, r.observed, r.variance
  from jsonb_to_recordset(p_rows) as r(
    external_id text, coil text, item_code text, item_name text, observed integer, variance integer);
  get diagnostics saved = row_count;
  return saved;
end $$;

revoke all on function public.import_stock_variances(date, text, jsonb) from public;
grant execute on function public.import_stock_variances(date, text, jsonb) to authenticated;
