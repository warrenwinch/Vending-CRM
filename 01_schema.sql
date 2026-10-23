-- =====================================================================
-- Vending CRM: database setup, slice 1
-- Run once in Supabase: SQL Editor > New query > paste all > Run
-- Multi-tenant: every row belongs to one organization, and row-level
-- security (RLS) makes sure users only ever see their own organization.
-- =====================================================================

-- ---------- 1. Lists of allowed values ----------
create type user_role        as enum ('administrator', 'manager', 'warehouse', 'filler');
create type client_status    as enum ('prospect', 'active', 'lost');
create type location_status  as enum ('prospect', 'active', 'lost');
create type location_type    as enum ('office', 'school', 'healthcare', 'gym', 'retail', 'industrial', 'government', 'other');
create type machine_type     as enum ('snack', 'drink', 'combo', 'coffee', 'micro_market', 'other');
create type machine_status   as enum ('in_storage', 'installed', 'needs_repair', 'retired');
create type commission_type  as enum ('none', 'percentage', 'fixed_monthly');
create type payment_method   as enum ('bank_transfer', 'cheque', 'cash', 'other');

-- ---------- 2. Tables ----------

create table organizations (
  id                   uuid primary key default gen_random_uuid(),
  trading_name         text not null,
  legal_name           text,
  abn                  text check (abn is null or abn ~ '^[0-9]{11}$'),
  acn                  text check (acn is null or acn ~ '^[0-9]{9}$'),
  gst_registered       boolean not null default false,
  country              text not null default 'AU',
  currency             text not null default 'AUD',
  timezone             text not null default 'Australia/Sydney',
  next_machine_number  integer not null default 1,   -- drives VM-001, VM-002...
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One row per person who logs in. id matches their Supabase login.
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  full_name        text not null,
  email            text not null,
  phone            text,
  role             user_role not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on profiles (organization_id);

-- Helper functions used by the security rules below.
-- They look up the logged-in user's organization and role.
create function public.current_org_id() returns uuid
  language sql stable security definer set search_path = public as
  $$ select organization_id from profiles where id = auth.uid() and active $$;

create function public.current_user_role() returns user_role
  language sql stable security definer set search_path = public as
  $$ select role from profiles where id = auth.uid() and active $$;

-- NOTE: every table below has a composite unique (id, organization_id).
-- Child tables point at it, which makes it impossible for a row in one
-- organization to link to a row in another, even by mistake.

create table clients (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  company_name      text not null,
  abn               text check (abn is null or abn ~ '^[0-9]{11}$'),   -- optional
  billing_contact   text,
  billing_email     text,
  billing_phone     text,
  gst_registered    boolean not null default false,
  status            client_status not null default 'prospect',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, organization_id)
);
create index on clients (organization_id);

create table locations (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  client_id               uuid not null,
  site_name               text not null,
  address                 text,
  placement_notes         text,               -- where in the building machines go
  type                    location_type not null default 'other',
  foot_traffic            text,
  operating_hours         text,
  access_instructions     text,
  status                  location_status not null default 'prospect',
  commission_type         commission_type not null default 'none',
  commission_rate         numeric(10,2),      -- percent, or dollars per month
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id) references clients (id, organization_id) on delete restrict
);
create index on locations (organization_id, client_id);

-- A contact belongs to a client (manages many sites) and optionally to one site.
create table contacts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  client_id         uuid not null,
  location_id       uuid,
  full_name         text not null,
  role_title        text,                     -- decision-maker, facilities manager...
  phone             text,
  email             text,
  is_main_contact   boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id)   references clients (id, organization_id)   on delete cascade,
  foreign key (location_id, organization_id) references locations (id, organization_id) on delete cascade
);
create index on contacts (organization_id, client_id);

create table machines (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  machine_number    text,                     -- filled automatically: VM-001
  manufacturer      text,
  model             text,
  serial_number     text,
  type              machine_type not null default 'snack',
  payment_hardware  text,                     -- cash only, card reader + provider
  status            machine_status not null default 'in_storage',
  purchase_date     date,
  purchase_cost     numeric(12,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, machine_number)
);

-- Gives each new machine the next number for its organization. Numbers are never reused.
create function public.assign_machine_number() returns trigger
  language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if new.machine_number is null then
    update organizations set next_machine_number = next_machine_number + 1
      where id = new.organization_id
      returning next_machine_number - 1 into n;
    new.machine_number := 'VM-' || lpad(n::text, 3, '0');
  end if;
  return new;
end $$;
create trigger machines_assign_number before insert on machines
  for each row execute function public.assign_machine_number();

-- Every move is a row. A row with no end date is where the machine is now.
create table machine_placements (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  machine_id        uuid not null,
  location_id       uuid not null,
  started_on        date not null default current_date,
  ended_on          date,
  created_at        timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  foreign key (machine_id, organization_id)  references machines (id, organization_id)  on delete cascade,
  foreign key (location_id, organization_id) references locations (id, organization_id) on delete restrict
);
create index on machine_placements (organization_id, location_id);
-- A machine can only be in one place at a time:
create unique index one_open_placement_per_machine on machine_placements (machine_id) where ended_on is null;

-- Handy view: each machine with its current location (if any).
create view machines_with_location with (security_invoker = true) as
  select m.*, p.location_id as current_location_id
  from machines m
  left join machine_placements p on p.machine_id = m.id and p.ended_on is null;

-- One payment per bank transfer / cheque, made to a client...
create table commission_payments (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  client_id             uuid not null,
  paid_on               date not null,
  method                payment_method not null default 'bank_transfer',
  reference             text,
  total_amount_paid     numeric(12,2) not null,
  gst_amount            numeric(12,2) not null default 0,
  notes                 text,
  created_by            uuid default auth.uid() references profiles(id),
  created_at            timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id) references clients (id, organization_id) on delete restrict
);
create index on commission_payments (organization_id, client_id);

-- ...with one line per site it covers.
create table commission_payment_lines (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  payment_id        uuid not null,
  location_id       uuid not null,
  period_start      date not null,
  period_end        date not null,
  sales_amount      numeric(12,2),            -- optional
  rate_applied      numeric(10,2),            -- percent or fixed dollars
  rate_type         commission_type,
  commission_amount numeric(12,2) not null,
  check (period_end >= period_start),
  foreign key (payment_id, organization_id)  references commission_payments (id, organization_id) on delete cascade,
  foreign key (location_id, organization_id) references locations (id, organization_id) on delete restrict
);
create index on commission_payment_lines (organization_id, payment_id);

-- General notes log, attached to exactly one client, location or machine.
create table notes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  client_id         uuid,
  location_id       uuid,
  machine_id        uuid,
  body              text not null,
  author_id         uuid not null default auth.uid() references profiles(id),
  created_at        timestamptz not null default now(),
  check (num_nonnulls(client_id, location_id, machine_id) = 1),
  foreign key (client_id, organization_id)   references clients (id, organization_id)   on delete cascade,
  foreign key (location_id, organization_id) references locations (id, organization_id) on delete cascade,
  foreign key (machine_id, organization_id)  references machines (id, organization_id)  on delete cascade
);
create index on notes (organization_id);

-- Keep updated_at current
create function public.touch_updated_at() returns trigger language plpgsql as
  $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['organizations','profiles','clients','locations','contacts','machines'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------- 3. Sign-up: create your organization ----------
-- Called once by the app right after a new person signs up. Makes the
-- organization and makes that person its Administrator.
create function public.create_organization(p_trading_name text, p_full_name text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'This user already belongs to an organization';
  end if;
  insert into organizations (trading_name) values (p_trading_name) returning id into new_org;
  insert into profiles (id, organization_id, full_name, email, role)
    values (auth.uid(), new_org, p_full_name, p_email, 'administrator');
  return new_org;
end $$;
revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- ---------- 4. Security rules (row-level security) ----------
alter table organizations             enable row level security;
alter table profiles                  enable row level security;
alter table clients                   enable row level security;
alter table locations                 enable row level security;
alter table contacts                  enable row level security;
alter table machines                  enable row level security;
alter table machine_placements        enable row level security;
alter table commission_payments       enable row level security;
alter table commission_payment_lines  enable row level security;
alter table notes                     enable row level security;

-- Organization: everyone in it can read it; only Administrators can change it.
create policy org_read   on organizations for select using (id = public.current_org_id());
create policy org_update on organizations for update
  using (id = public.current_org_id() and public.current_user_role() = 'administrator')
  with check (id = public.current_org_id());

-- Users: everyone sees their colleagues; only Administrators add/change/remove.
create policy profiles_read on profiles for select using (organization_id = public.current_org_id());
create policy profiles_admin_write on profiles for all
  using (organization_id = public.current_org_id() and public.current_user_role() = 'administrator')
  with check (organization_id = public.current_org_id() and public.current_user_role() = 'administrator');

-- Clients, contacts, commission: Administrator and Manager only.
create policy clients_rw on clients for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

create policy contacts_rw on contacts for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

create policy commpay_rw on commission_payments for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

create policy commlines_rw on commission_payment_lines for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

-- Locations: all roles can read (Fillers need addresses and access instructions);
-- only Administrator and Manager can change.
-- TODO (routes phase): limit Fillers to their assigned stops.
create policy locations_read on locations for select using (organization_id = public.current_org_id());
create policy locations_write on locations for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

-- Machines and placements: all roles read; Administrator, Manager, Warehouse change.
-- TODO: purchase_cost is visible to Warehouse and Filler. Hide it behind a
-- view when we tighten permissions.
create policy machines_read on machines for select using (organization_id = public.current_org_id());
create policy machines_write on machines for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager','warehouse'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager','warehouse'));

create policy placements_read on machine_placements for select using (organization_id = public.current_org_id());
create policy placements_write on machine_placements for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager','warehouse'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager','warehouse'));

-- Notes: Administrator/Manager see everything. Warehouse/Filler see and add
-- notes on locations and machines only (never on clients).
create policy notes_read on notes for select using (
  organization_id = public.current_org_id()
  and (public.current_user_role() in ('administrator','manager') or client_id is null));
create policy notes_insert on notes for insert with check (
  organization_id = public.current_org_id()
  and author_id = auth.uid()
  and (public.current_user_role() in ('administrator','manager') or client_id is null));
create policy notes_admin_change on notes for update using (
  organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id());
create policy notes_admin_delete on notes for delete using (
  organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));
