-- =====================================================================
-- Vending CRM: database change 6 — customers report faults by QR code
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Each machine gets a long random code for its QR sticker. Anyone who
-- scans it can report a problem with THAT machine without logging in,
-- through two small database functions. They can't read anything else:
-- no clients, no other machines, no other faults. Reports are limited
-- per machine and per business each hour to stop spam.
-- =====================================================================

-- ---------- 1. A secret code per machine, for its QR sticker ----------
-- (32 random characters; every existing machine gets its own.)
alter table machines
  add column public_token text not null unique default replace(gen_random_uuid()::text, '-', '');

-- ---------- 2. Faults can come from a customer instead of a team member ----------
alter table machine_faults
  alter column reported_by drop not null,
  add column reported_by_public boolean not null default false,
  add column reporter_contact text check (reporter_contact is null or length(reporter_contact) <= 200),
  add constraint machine_faults_has_reporter check (reported_by is not null or reported_by_public);

-- ---------- 3. What the QR page may show: just enough to confirm the machine ----------
create function public.public_machine(p_token text)
returns table (machine_number text, business_name text, site_name text)
language sql stable security definer set search_path = public as $$
  select m.machine_number, o.trading_name, l.site_name
  from machines m
  join organizations o on o.id = m.organization_id
  left join machine_placements p on p.machine_id = m.id and p.ended_on is null
  left join locations l on l.id = p.location_id
  where m.public_token = p_token and m.status <> 'retired'
$$;

-- ---------- 4. Logging a customer's report ----------
create function public.report_public_fault(
  p_token text, p_category fault_category, p_severity fault_severity, p_description text, p_contact text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  m      machines;
  loc    uuid;
  recent integer;
begin
  select * into m from machines where public_token = p_token and status <> 'retired';
  if not found then raise exception 'machine_not_found'; end if;

  p_description := trim(coalesce(p_description, ''));
  if length(p_description) < 3 or length(p_description) > 1000 then raise exception 'bad_description'; end if;
  p_contact := nullif(trim(coalesce(p_contact, '')), '');
  if p_contact is not null and length(p_contact) > 200 then raise exception 'bad_contact'; end if;

  -- Spam limits: 3 reports per machine and 30 per business, each hour.
  select count(*) into recent from machine_faults
    where machine_id = m.id and reported_by_public and created_at > now() - interval '1 hour';
  if recent >= 3 then raise exception 'too_many_reports'; end if;
  select count(*) into recent from machine_faults
    where organization_id = m.organization_id and reported_by_public and created_at > now() - interval '1 hour';
  if recent >= 30 then raise exception 'too_many_reports'; end if;

  select location_id into loc from machine_placements where machine_id = m.id and ended_on is null;

  insert into machine_faults
    (organization_id, machine_id, location_id, category, severity, description,
     reported_by, reported_by_public, reporter_contact)
  values
    (m.organization_id, m.id, loc, p_category, p_severity, p_description,
     null, true, p_contact);
  return m.machine_number;
end $$;

revoke all on function public.public_machine(text) from public;
revoke all on function public.report_public_fault(text, fault_category, fault_severity, text, text) from public;
grant execute on function public.public_machine(text) to anon, authenticated;
grant execute on function public.report_public_fault(text, fault_category, fault_severity, text, text) to anon, authenticated;
