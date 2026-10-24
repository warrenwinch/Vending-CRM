-- =====================================================================
-- Vending CRM: database change 8 — machines show "Needs repair" by themselves
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- While a machine has an open fault marked "Not working at all", its
-- status is Needs repair. When the last such fault is fixed (or deleted,
-- or changed to "Partly working"), it goes back to Installed if it's at a
-- site, or In storage if not. Retired machines are never touched.
-- Works for faults from staff and from customers' QR reports.
-- No tables change; this adds one automatic rule.
-- =====================================================================

create function public.sync_machine_repair_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mid     uuid := coalesce(new.machine_id, old.machine_id);
  current machine_status;
  broken  boolean;
  cleared boolean;
begin
  select status into current from machines where id = mid;
  if current is null or current = 'retired' then return null; end if;

  select exists (
    select 1 from machine_faults where machine_id = mid and fixed_at is null and severity = 'not_working'
  ) into broken;

  -- Did this change just close a "not working at all" fault?
  cleared := old.severity = 'not_working' and old.fixed_at is null and (
    tg_op = 'DELETE' or new.fixed_at is not null or new.severity <> 'not_working'
  );

  if broken and current <> 'needs_repair' then
    update machines set status = 'needs_repair' where id = mid;
  elsif not broken and cleared and current = 'needs_repair' then
    update machines
      set status = case
        when exists (select 1 from machine_placements where machine_id = mid and ended_on is null)
        then 'installed'::machine_status else 'in_storage'::machine_status end
      where id = mid;
  end if;
  return null;
end $$;

create trigger machine_faults_sync_repair_status
  after insert or update or delete on machine_faults
  for each row execute function public.sync_machine_repair_status();

-- Bring machines that already have such a fault open into line now.
update machines m set status = 'needs_repair'
  where m.status not in ('needs_repair', 'retired')
    and exists (select 1 from machine_faults f
                where f.machine_id = m.id and f.fixed_at is null and f.severity = 'not_working');
