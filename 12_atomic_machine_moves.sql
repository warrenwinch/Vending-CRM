-- =====================================================================
-- Vending CRM: database change 12 — moving a machine is all-or-nothing
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Moving a machine used to be saved as separate steps (close the old
-- site, open the new one, set the status). If the connection dropped in
-- between, a machine could be left at no site. These two functions do
-- every step together: either all of it is saved, or none of it.
--
-- They run as the person using the app, so the usual security rules
-- still apply (only Administrator, Manager and Warehouse can move
-- machines). No tables change; history is still never overwritten.
-- =====================================================================

-- Place a machine at a site, or move it. p_from_placement is where the app
-- saw the machine (null if in storage); if someone moved it since, nothing
-- is saved.
create function public.move_machine(
  p_machine_id     uuid,
  p_location_id    uuid,
  p_position       text,
  p_date           date,
  p_from_placement uuid
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  m_status machine_status;
  open_id  uuid;
begin
  -- Lock the machine so two moves can't happen at once.
  select status into m_status from machines where id = p_machine_id for update;
  if m_status is null then raise exception 'This machine wasn''t found.'; end if;
  if m_status = 'retired' then
    raise exception 'This machine is retired. Change its status before placing it.';
  end if;

  select id into open_id from machine_placements where machine_id = p_machine_id and ended_on is null;
  if open_id is distinct from p_from_placement then
    raise exception 'Someone else just moved this machine. Please reload the page and try again.';
  end if;

  if open_id is not null then
    update machine_placements set ended_on = p_date where id = open_id;
  end if;

  insert into machine_placements (machine_id, location_id, position, started_on)
  values (p_machine_id, p_location_id, nullif(trim(p_position), ''), p_date);

  -- Placed means Installed, unless a "not working at all" fault is still open.
  if m_status <> 'installed' and not exists (
    select 1 from machine_faults
    where machine_id = p_machine_id and fixed_at is null and severity = 'not_working'
  ) then
    update machines set status = 'installed' where id = p_machine_id;
  end if;
end $$;

-- Take a machine out of its site, into storage or off for repair.
create function public.take_out_machine(
  p_machine_id     uuid,
  p_date           date,
  p_status         machine_status,
  p_from_placement uuid
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  open_id uuid;
begin
  if p_status not in ('in_storage', 'needs_repair') then
    raise exception 'Please choose what happens to the machine.';
  end if;

  perform 1 from machines where id = p_machine_id for update;
  if not found then raise exception 'This machine wasn''t found.'; end if;

  select id into open_id from machine_placements where machine_id = p_machine_id and ended_on is null;
  if open_id is null or open_id is distinct from p_from_placement then
    raise exception 'Someone else just moved this machine. Please reload the page and try again.';
  end if;

  update machine_placements set ended_on = p_date where id = open_id;
  update machines set status = p_status where id = p_machine_id;
end $$;

revoke all on function public.move_machine(uuid, uuid, text, date, uuid) from public;
revoke all on function public.take_out_machine(uuid, date, machine_status, uuid) from public;
grant execute on function public.move_machine(uuid, uuid, text, date, uuid) to authenticated;
grant execute on function public.take_out_machine(uuid, date, machine_status, uuid) to authenticated;
