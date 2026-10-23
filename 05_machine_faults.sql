-- =====================================================================
-- Vending CRM: database change 5 — machine faults
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Anyone in the team can report a fault on a machine and mark it fixed.
-- Each fault records when it was found and when it was fixed, so the app
-- can show how long faults take to fix. Nothing existing is changed.
-- =====================================================================

create type fault_category as enum (
  'vend_failure', 'coin_mechanism', 'note_reader', 'card_reader',
  'refrigeration', 'display', 'door_lock', 'power', 'other'
);
create type fault_severity as enum ('not_working', 'partly_working');

create table machine_faults (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  machine_id       uuid not null,
  location_id      uuid,                       -- where the machine was when the fault was found
  category         fault_category not null default 'other',
  severity         fault_severity not null default 'partly_working',
  description      text not null check (length(description) between 1 and 2000),
  reported_by      uuid not null default auth.uid() references profiles(id),
  reported_at      timestamptz not null default now(),   -- when it was found
  fixed_by         uuid references profiles(id),
  fixed_at         timestamptz,
  fix_notes        text check (fix_notes is null or length(fix_notes) <= 2000),
  created_at       timestamptz not null default now(),
  check (fixed_at is null or fixed_at >= reported_at),
  check ((fixed_at is null) = (fixed_by is null)),
  foreign key (machine_id, organization_id)  references machines (id, organization_id)  on delete cascade,
  foreign key (location_id, organization_id) references locations (id, organization_id) on delete restrict
);
create index on machine_faults (organization_id, machine_id);
create index machine_faults_open on machine_faults (organization_id) where fixed_at is null;

alter table machine_faults enable row level security;

-- Everyone in the business can see faults and report them (as themselves).
create policy faults_read on machine_faults for select
  using (organization_id = public.current_org_id());

create policy faults_report on machine_faults for insert
  with check (organization_id = public.current_org_id()
              and reported_by = auth.uid()
              and (fixed_by is null or fixed_by = auth.uid()));

-- Anyone can mark a fault fixed (as themselves); the office can also correct details.
create policy faults_update on machine_faults for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id()
              and (fixed_by is null or fixed_by = auth.uid()
                   or public.current_user_role() in ('administrator','manager')));

-- Only the office can delete (for faults logged by mistake).
create policy faults_delete on machine_faults for delete
  using (organization_id = public.current_org_id()
         and public.current_user_role() in ('administrator','manager'));

-- Warehouse and Filler can only fill in the "fixed" part; what was
-- reported, by whom and when stays as it was logged.
create function public.protect_fault_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() not in ('administrator','manager') and (
       new.organization_id is distinct from old.organization_id
    or new.machine_id      is distinct from old.machine_id
    or new.location_id     is distinct from old.location_id
    or new.category        is distinct from old.category
    or new.severity        is distinct from old.severity
    or new.description     is distinct from old.description
    or new.reported_by     is distinct from old.reported_by
    or new.reported_at     is distinct from old.reported_at)
  then
    raise exception 'Only Administrators and Managers can change a fault report';
  end if;
  return new;
end $$;
create trigger machine_faults_protect_report before update on machine_faults
  for each row execute function public.protect_fault_report();
