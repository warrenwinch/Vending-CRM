-- =====================================================================
-- Vending CRM: database change 13 — enquiries from your website
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- A public enquiry form (no login) can add a new Prospect customer with
-- one Prospect site holding their address, staff/visitor numbers and
-- message. Like the QR fault reports, it goes through two small database
-- functions that can't read or change anything else. No tables change.
-- =====================================================================

-- What the form may show: just the business name, so visitors know whose form it is.
create function public.public_business_name(p_org uuid)
returns text
language sql stable security definer set search_path = public as $$
  select trading_name from organizations where id = p_org
$$;

-- Saving an enquiry. Returns the new customer's id (for the alert email's link).
create function public.submit_website_lead(
  p_org      uuid,
  p_company  text,
  p_contact  text,
  p_email    text,
  p_phone    text,
  p_address  text,
  p_people   text,
  p_message  text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  recent    integer;
  new_client uuid;
  tidy      text;
begin
  if not exists (select 1 from organizations where id = p_org) then raise exception 'form_not_found'; end if;

  p_company := trim(coalesce(p_company, ''));
  p_contact := trim(coalesce(p_contact, ''));
  p_email   := nullif(lower(trim(coalesce(p_email, ''))), '');
  p_phone   := nullif(trim(coalesce(p_phone, '')), '');
  p_address := nullif(trim(coalesce(p_address, '')), '');
  p_people  := nullif(trim(coalesce(p_people, '')), '');
  p_message := nullif(trim(coalesce(p_message, '')), '');

  if length(p_company) < 2 or length(p_company) > 200 then raise exception 'bad_company'; end if;
  if length(p_contact) < 2 or length(p_contact) > 200 then raise exception 'bad_contact'; end if;
  if p_email is null and p_phone is null then raise exception 'no_way_to_reach'; end if;
  if p_email is not null and (length(p_email) > 200 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'bad_email';
  end if;
  if length(p_phone) > 40 or length(p_address) > 300 or length(p_people) > 100 or length(p_message) > 2000 then
    raise exception 'too_long';
  end if;

  -- Spam limit: 10 website enquiries per business each hour.
  select count(*) into recent from locations
    where organization_id = p_org
      and placement_notes like 'Website enquiry%'
      and created_at > now() - interval '1 hour';
  if recent >= 10 then raise exception 'too_many_enquiries'; end if;

  insert into clients (organization_id, company_name, billing_contact, billing_email, billing_phone, status)
  values (p_org, p_company, p_contact, p_email, p_phone, 'prospect')
  returning id into new_client;

  tidy := 'Website enquiry ' || to_char(now() at time zone 'Australia/Sydney', 'DD/MM/YYYY')
    || coalesce(E'\n' || p_message, '');
  insert into locations (organization_id, client_id, site_name, address, foot_traffic, placement_notes, status)
  values (p_org, new_client, p_company, p_address, p_people, tidy, 'prospect');

  return new_client;
end $$;

revoke all on function public.public_business_name(uuid) from public;
revoke all on function public.submit_website_lead(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.public_business_name(uuid) to anon, authenticated;
grant execute on function public.submit_website_lead(uuid, text, text, text, text, text, text, text) to anon, authenticated;
