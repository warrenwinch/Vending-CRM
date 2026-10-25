-- =====================================================================
-- Vending CRM: database change 14 — regular maintenance
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds two new tables. Nothing existing changes.
--   maintenance_plans  each machine's regular jobs: what, how often, next due
--   maintenance_done   one row each time a job is done (the history)
-- Everyone can see both. Administrators and Managers set up plans; anyone
-- (including Fillers) can mark a job done, which goes through one
-- all-or-nothing database step that records it and sets the next due date.
-- =====================================================================

create table maintenance_plans (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  machine_id        uuid not null,
  task              text not null check (length(trim(task)) between 2 and 120),
  every_count       integer not null check (every_count between 1 and 104),
  every_unit        text not null default 'weeks' check (every_unit in ('weeks', 'months')),
  next_due          date not null,
  notes             text check (notes is null or length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (machine_id, organization_id) references machines (id, organization_id) on delete cascade
);
create index on maintenance_plans (organization_id, next_due);
create index on maintenance_plans (machine_id);
create trigger maintenance_plans_touch before update on maintenance_plans
  for each row execute function public.touch_updated_at();

create table maintenance_done (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  plan_id           uuid,                 -- kept as history even if the plan is later deleted
  machine_id        uuid not null,
  location_id       uuid,                 -- where the machine was when the job was done
  task              text not null,
  due_on            date not null,
  done_on           date not null,
  done_by           uuid not null default auth.uid() references profiles(id),
  notes             text check (notes is null or length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  foreign key (plan_id, organization_id)     references maintenance_plans (id, organization_id) on delete set null (plan_id),
  foreign key (machine_id, organization_id)  references machines (id, organization_id)          on delete cascade,
  foreign key (location_id, organization_id) references locations (id, organization_id)         on delete set null (location_id)
);
create index on maintenance_done (organization_id, machine_id, done_on desc);

alter table maintenance_plans enable row level security;
alter table maintenance_done  enable row level security;

create policy mplans_read on maintenance_plans for select using (organization_id = public.current_org_id());
create policy mplans_write on maintenance_plans for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

-- History is added only by mark_maintenance_done below; office can remove mistakes.
create policy mdone_read on maintenance_done for select using (organization_id = public.current_org_id());
create policy mdone_delete on maintenance_done for delete
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager'));

-- Marks a job done and sets the next due date, counted from the day it was
-- done. Anyone active in the business may do it. Returns the next due date.
create function public.mark_maintenance_done(p_plan uuid, p_done_on date, p_notes text)
returns date
language plpgsql security definer set search_path = public as $$
declare
  plan  maintenance_plans;
  loc   uuid;
  today date := (now() at time zone 'Australia/Sydney')::date;
  next_on date;
begin
  if public.current_user_role() is null then raise exception 'Please log in again.'; end if;

  select * into plan from maintenance_plans
    where id = p_plan and organization_id = public.current_org_id()
    for update;
  if not found then raise exception 'This maintenance job wasn''t found.'; end if;

  if p_done_on is null or p_done_on > today then raise exception 'The date can''t be in the future.'; end if;
  if p_done_on < today - 365 then raise exception 'The date is more than a year ago. Please check it.'; end if;
  p_notes := nullif(trim(coalesce(p_notes, '')), '');
  if length(p_notes) > 1000 then raise exception 'Please keep the notes under 1000 characters.'; end if;

  select location_id into loc from machine_placements where machine_id = plan.machine_id and ended_on is null;

  insert into maintenance_done (organization_id, plan_id, machine_id, location_id, task, due_on, done_on, done_by, notes)
  values (plan.organization_id, plan.id, plan.machine_id, loc, plan.task, plan.next_due, p_done_on, auth.uid(), p_notes);

  next_on := (p_done_on + case plan.every_unit
    when 'weeks' then make_interval(weeks => plan.every_count)
    else make_interval(months => plan.every_count) end)::date;
  update maintenance_plans set next_due = next_on where id = plan.id;
  return next_on;
end $$;

revoke all on function public.mark_maintenance_done(uuid, date, text) from public;
grant execute on function public.mark_maintenance_done(uuid, date, text) to authenticated;
