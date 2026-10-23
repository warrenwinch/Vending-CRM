-- =====================================================================
-- Vending CRM: database change 3 — inviting team members
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- How it works: an Administrator invites an email address with a role.
-- That person signs up normally with the same email. Once their email is
-- confirmed, they see the invitation and join the business with that role.
-- No secret "service role" key is needed anywhere.
-- =====================================================================

-- ---------- 1. Invitations ----------
create table invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  email            text not null check (email = lower(email) and email like '%@%'),
  full_name        text,
  role             user_role not null,
  invited_by       uuid default auth.uid() references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '14 days',
  accepted_at      timestamptz,
  revoked_at       timestamptz
);
create index on invitations (organization_id);
create index on invitations (email);
-- Only one open invitation per email in each business.
create unique index one_open_invitation_per_email on invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

alter table invitations enable row level security;

-- Only Administrators see and manage their business's invitations.
create policy invitations_admin on invitations for all
  using (organization_id = public.current_org_id() and public.current_user_role() = 'administrator')
  with check (organization_id = public.current_org_id() and public.current_user_role() = 'administrator');

-- ---------- 2. For the person being invited ----------

-- Open invitations for the logged-in person's confirmed email.
create function public.my_invitations()
returns table (id uuid, organization_name text, role user_role, full_name text)
language sql stable security definer set search_path = public as $$
  select i.id, o.trading_name, i.role, i.full_name
  from invitations i
  join organizations o on o.id = i.organization_id
  join auth.users u on u.id = auth.uid()
  where i.email = lower(u.email)
    and u.email_confirmed_at is not null
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and not exists (select 1 from profiles where profiles.id = auth.uid())
  order by i.created_at
$$;

-- Joins the business named in the invitation, with the invited role.
create function public.accept_invitation(p_invitation_id uuid, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv invitations;
  u   auth.users;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'This user already belongs to an organization';
  end if;

  select * into u from auth.users where id = auth.uid();
  if u.email_confirmed_at is null then raise exception 'Please confirm your email first'; end if;

  select * into inv from invitations
    where id = p_invitation_id and email = lower(u.email)
      and accepted_at is null and revoked_at is null and expires_at > now()
    for update;
  if not found then raise exception 'This invitation is no longer available'; end if;

  insert into profiles (id, organization_id, full_name, email, role)
    values (auth.uid(), inv.organization_id,
            coalesce(nullif(trim(p_full_name), ''), inv.full_name, lower(u.email)),
            lower(u.email), inv.role);
  update invitations set accepted_at = now() where id = inv.id;
  return inv.organization_id;
end $$;

-- 'none' (not in a business yet), 'active', or 'inactive' (switched off).
create function public.my_account_status()
returns text language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from profiles where id = auth.uid()) then 'none'
    when exists (select 1 from profiles where id = auth.uid() and active) then 'active'
    else 'inactive'
  end
$$;

revoke all on function public.my_invitations()                 from public, anon;
revoke all on function public.accept_invitation(uuid, text)     from public, anon;
revoke all on function public.my_account_status()              from public, anon;
grant execute on function public.my_invitations()               to authenticated;
grant execute on function public.accept_invitation(uuid, text)  to authenticated;
grant execute on function public.my_account_status()            to authenticated;

-- ---------- 3. Never lock everyone out ----------
-- A business must always keep at least one active Administrator.
create function public.keep_an_administrator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'administrator' and old.active
     and (tg_op = 'DELETE' or new.role <> 'administrator' or not new.active)
     and not exists (
       select 1 from profiles
       where organization_id = old.organization_id and id <> old.id
         and role = 'administrator' and active)
  then
    raise exception 'A business needs at least one active Administrator';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger profiles_keep_an_administrator before update or delete on profiles
  for each row execute function public.keep_an_administrator();
