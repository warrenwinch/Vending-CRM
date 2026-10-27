-- =====================================================================
-- Vending CRM: database change 16 — tags on machines
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds two new tables. Nothing existing changes.
--   tags          the business's own labels, e.g. "Cashless", each with a colour
--   machine_tags  which machines have which tag
-- Everyone (Fillers too) can see tags, create new ones, and add or remove
-- them on machines. Renaming, recolouring and deleting a tag is for
-- Administrators and Managers. Deleting a tag takes it off every machine.
-- =====================================================================

create table tags (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 40),
  colour            text not null default 'grey'
                      check (colour in ('grey', 'orange', 'green', 'blue', 'red', 'purple', 'yellow')),
  created_at        timestamptz not null default now(),
  unique (id, organization_id)
);
-- The same name can't be added twice ("cashless" and "Cashless" count as the same).
create unique index tags_unique_name on tags (organization_id, lower(trim(name)));

create table machine_tags (
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  machine_id        uuid not null,
  tag_id            uuid not null,
  created_at        timestamptz not null default now(),
  primary key (machine_id, tag_id),
  foreign key (machine_id, organization_id) references machines (id, organization_id) on delete cascade,
  foreign key (tag_id, organization_id)     references tags (id, organization_id)     on delete cascade
);
create index on machine_tags (organization_id, tag_id);

alter table tags         enable row level security;
alter table machine_tags enable row level security;

create policy tags_read on tags for select using (organization_id = public.current_org_id());
create policy tags_add on tags for insert
  with check (organization_id = public.current_org_id() and public.current_user_role() is not null);
create policy tags_change on tags for update
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id());
create policy tags_remove on tags for delete
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

create policy mtags_read on machine_tags for select using (organization_id = public.current_org_id());
create policy mtags_add on machine_tags for insert
  with check (organization_id = public.current_org_id() and public.current_user_role() is not null);
create policy mtags_remove on machine_tags for delete
  using (organization_id = public.current_org_id() and public.current_user_role() is not null);
