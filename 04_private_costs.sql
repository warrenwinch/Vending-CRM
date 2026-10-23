-- =====================================================================
-- Vending CRM: database change 4 — keep money figures from Warehouse and Filler
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Security rules in Postgres work on whole rows, not single columns. So
-- a site's commission and a machine's purchase cost move into their own
-- small tables that only Administrators and Managers can read or change.
-- Existing figures are copied across first; it all happens in one go, so
-- if anything fails nothing is changed.
-- =====================================================================

begin;

-- ---------- 1. Commission per location ----------
create table location_commissions (
  location_id      uuid primary key,
  organization_id  uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  commission_type  commission_type not null default 'none',
  commission_rate  numeric(10,2),               -- percent, or dollars per month
  updated_at       timestamptz not null default now(),
  foreign key (location_id, organization_id) references locations (id, organization_id) on delete cascade
);
create index on location_commissions (organization_id);

insert into location_commissions (location_id, organization_id, commission_type, commission_rate)
  select id, organization_id, commission_type, commission_rate from locations;

alter table locations drop column commission_type, drop column commission_rate;

-- ---------- 2. Purchase cost per machine ----------
create table machine_costs (
  machine_id       uuid primary key,
  organization_id  uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  purchase_cost    numeric(12,2),
  updated_at       timestamptz not null default now(),
  foreign key (machine_id, organization_id) references machines (id, organization_id) on delete cascade
);
create index on machine_costs (organization_id);

insert into machine_costs (machine_id, organization_id, purchase_cost)
  select id, organization_id, purchase_cost from machines where purchase_cost is not null;

-- The "machines with location" view includes every machine column, so it
-- is rebuilt without purchase_cost.
drop view machines_with_location;
alter table machines drop column purchase_cost;
create view machines_with_location with (security_invoker = true) as
  select m.*, p.location_id as current_location_id
  from machines m
  left join machine_placements p on p.machine_id = m.id and p.ended_on is null;

-- ---------- 3. Security rules: Administrator and Manager only ----------
alter table location_commissions enable row level security;
alter table machine_costs        enable row level security;

create policy location_commissions_office on location_commissions for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

create policy machine_costs_office on machine_costs for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

do $$ declare t text; begin
  foreach t in array array['location_commissions','machine_costs'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

commit;
