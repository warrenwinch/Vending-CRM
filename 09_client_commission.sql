-- =====================================================================
-- Vending CRM: database change 9 — commission set on the client
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- A client gets a default commission (e.g. 10% of sales). Each of its
-- sites uses that default unless the site has its own deal. Like site
-- commission, it's private to Administrators and Managers.
-- Existing site deals are kept exactly as they are.
-- =====================================================================

begin;

-- ---------- 1. The client's default ----------
create table client_commissions (
  client_id        uuid primary key,
  organization_id  uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  commission_type  commission_type not null default 'none',
  commission_rate  numeric(10,2),               -- percent, or dollars per month
  updated_at       timestamptz not null default now(),
  foreign key (client_id, organization_id) references clients (id, organization_id) on delete cascade
);
create index on client_commissions (organization_id);

alter table client_commissions enable row level security;
create policy client_commissions_office on client_commissions for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

create trigger client_commissions_touch before update on client_commissions
  for each row execute function public.touch_updated_at();

-- ---------- 2. Does a site follow its client, or have its own deal? ----------
alter table location_commissions add column follows_client boolean not null default true;

-- Sites that already have a deal keep it; sites with none set follow the client.
update location_commissions set follows_client = (commission_type = 'none');

commit;
