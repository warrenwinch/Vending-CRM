-- =====================================================================
-- Vending CRM: database change 18 — monthly sales from Seed and Nayax
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds two new tables. Nothing existing changes.
--   machine_sales  one row per machine, per month, per system: units and dollars
--   sales_links    which Seed or Nayax ID belongs to which VM machine
--                  (or "don't track"), remembered so next month matches itself
-- Sales are money, so only Administrators and Managers can see or change them.
-- Importing a month again replaces that month for that system (never doubles).
-- =====================================================================

create table sales_links (
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  source            text not null check (source in ('seed_vending', 'seed_market', 'nayax')),
  external_id       text not null check (length(external_id) between 1 and 200),
  machine_id        uuid,               -- empty = "don't track" this ID
  created_at        timestamptz not null default now(),
  primary key (organization_id, source, external_id),
  foreign key (machine_id, organization_id) references machines (id, organization_id) on delete cascade
);

create table machine_sales (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  source            text not null check (source in ('seed_vending', 'seed_market', 'nayax')),
  external_id       text not null check (length(external_id) between 1 and 200),
  external_name     text check (external_name is null or length(external_name) <= 300),
  month             date not null check (extract(day from month) = 1),
  machine_id        uuid,               -- filled in from sales_links
  units             integer not null default 0,
  amount            numeric(12,2) not null,
  card_amount       numeric(12,2),
  cash_amount       numeric(12,2),
  imported_at       timestamptz not null default now(),
  imported_by       uuid default auth.uid() references profiles(id) on delete set null,
  unique (organization_id, source, external_id, month),
  foreign key (machine_id, organization_id) references machines (id, organization_id) on delete set null (machine_id)
);
create index on machine_sales (organization_id, month);
create index on machine_sales (machine_id, month);

alter table sales_links   enable row level security;
alter table machine_sales enable row level security;

create policy sales_links_office on sales_links for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));
create policy machine_sales_office on machine_sales for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

-- New sales rows pick up their machine from a remembered link.
create function public.sales_fill_machine() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.machine_id is null then
    select l.machine_id into new.machine_id from sales_links l
      where l.organization_id = new.organization_id and l.source = new.source and l.external_id = new.external_id;
  end if;
  return new;
end $$;
create trigger machine_sales_fill_machine before insert on machine_sales
  for each row execute function public.sales_fill_machine();

-- Matching (or re-matching) an ID updates every month already imported for it.
create function public.sales_apply_link() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  update machine_sales set machine_id = new.machine_id
    where organization_id = new.organization_id and source = new.source and external_id = new.external_id;
  return null;
end $$;
create trigger sales_links_apply after insert or update on sales_links
  for each row execute function public.sales_apply_link();

-- Saves one system's file for one month: removes that month's old rows for
-- that system and adds the new ones, all or nothing. Returns rows saved.
-- p_rows is a list of {external_id, external_name, units, amount, card_amount, cash_amount}.
create function public.import_sales(p_source text, p_month date, p_rows jsonb)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  saved integer;
begin
  if public.current_user_role() not in ('administrator','manager') then
    raise exception 'Only Administrators and Managers can import sales.';
  end if;
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'Please choose a month.'; end if;

  delete from machine_sales
    where organization_id = public.current_org_id() and source = p_source and month = p_month;

  insert into machine_sales (source, external_id, external_name, month, units, amount, card_amount, cash_amount)
  select p_source, r.external_id, r.external_name, p_month,
         coalesce(r.units, 0), r.amount, r.card_amount, r.cash_amount
  from jsonb_to_recordset(p_rows) as r(
    external_id text, external_name text, units integer, amount numeric, card_amount numeric, cash_amount numeric);
  get diagnostics saved = row_count;
  return saved;
end $$;

revoke all on function public.import_sales(text, date, jsonb) from public;
grant execute on function public.import_sales(text, date, jsonb) to authenticated;
