-- =====================================================================
-- Vending CRM: database change 17 — assign a repair to a team member
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds one optional column to faults: who the repair is given to. It
-- starts empty on every fault, so nothing existing changes. If that
-- person is ever removed, the fault goes back to nobody assigned.
-- Administrators, Managers and Warehouse can assign or reassign; the rule
-- that protects fault reports is updated so Fillers can't change it.
-- Anyone can still mark a fault fixed, exactly as before.
-- =====================================================================

alter table machine_faults
  add column assigned_to uuid references profiles(id) on delete set null;

create index on machine_faults (assigned_to) where fixed_at is null;

-- Same as before, plus: only Administrators, Managers and Warehouse may
-- change who a repair is assigned to.
create or replace function public.protect_fault_report() returns trigger
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
  if public.current_user_role() not in ('administrator','manager','warehouse')
     and new.assigned_to is distinct from old.assigned_to
  then
    raise exception 'Only Administrators, Managers and Warehouse can assign a repair';
  end if;
  return new;
end $$;
