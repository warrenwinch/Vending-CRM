-- =====================================================================
-- Vending CRM: database change 7 — show the position on the QR page
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- The page customers see after scanning a sticker now also gets the
-- machine's position on site (e.g. "Level 5N"). Only this one function
-- changes; no tables or data are touched.
-- =====================================================================

drop function public.public_machine(text);

create function public.public_machine(p_token text)
returns table (machine_number text, business_name text, site_name text, site_position text)
language sql stable security definer set search_path = public as $$
  select m.machine_number, o.trading_name, l.site_name, p.position
  from machines m
  join organizations o on o.id = m.organization_id
  left join machine_placements p on p.machine_id = m.id and p.ended_on is null
  left join locations l on l.id = p.location_id
  where m.public_token = p_token and m.status <> 'retired'
$$;

revoke all on function public.public_machine(text) from public;
grant execute on function public.public_machine(text) to anon, authenticated;
