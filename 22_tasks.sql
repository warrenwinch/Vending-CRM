-- =====================================================================
-- Vending CRM: database change 22 — team tasks
-- Run once in Supabase: SQL Editor > New query > paste all > Run
--
-- Adds one new table. Nothing existing changes.
--   tasks   a job for the team: what, when, who, and optionally which
--           customer, site or machine it's about
-- Administrators, Managers and Warehouse see every task and can add, edit,
-- assign and delete them. Fillers see only the tasks given to them.
-- Anyone who can see a task can tick it off, through the all-or-nothing
-- database steps at the bottom. Ticking off a repeating task also creates
-- the next one.
-- =====================================================================

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null default public.current_org_id() references organizations(id) on delete cascade,
  title             text not null check (length(trim(title)) between 2 and 200),
  notes             text check (notes is null or length(notes) <= 2000),
  category          text check (category in ('admin', 'warehouse')),   -- empty means neither
  priority          text not null default 'normal' check (priority in ('normal', 'high')),
  due_on            date,
  repeats           text not null default 'none'
                    check (repeats in ('none', 'daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'yearly')),
  assigned_to       uuid references profiles(id) on delete set null,
  client_id         uuid,
  location_id       uuid,
  machine_id        uuid,
  created_by        uuid default auth.uid() references profiles(id) on delete set null,
  done_at           timestamptz,
  done_by           uuid references profiles(id) on delete set null,
  next_task_id      uuid,                 -- the copy made when a repeating task was ticked off
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, organization_id),
  -- If a customer, site or machine is removed, the task stays with the link cleared.
  foreign key (client_id, organization_id)    references clients (id, organization_id)   on delete set null (client_id),
  foreign key (location_id, organization_id)  references locations (id, organization_id) on delete set null (location_id),
  foreign key (machine_id, organization_id)   references machines (id, organization_id)  on delete set null (machine_id),
  foreign key (next_task_id, organization_id) references tasks (id, organization_id)     on delete set null (next_task_id)
);
create index on tasks (organization_id, due_on) where done_at is null;
create index on tasks (organization_id, done_at desc) where done_at is not null;
create index on tasks (assigned_to);
create index on tasks (client_id);
create index on tasks (location_id);
create index on tasks (machine_id);
create index on tasks (next_task_id);
create trigger tasks_touch before update on tasks
  for each row execute function public.touch_updated_at();

alter table tasks enable row level security;

create policy tasks_read on tasks for select using (
  organization_id = public.current_org_id()
  and (public.current_user_role() in ('administrator','manager','warehouse') or assigned_to = auth.uid())
);
create policy tasks_write on tasks for all
  using (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager','warehouse'))
  with check (organization_id = public.current_org_id() and public.current_user_role() in ('administrator','manager','warehouse'));

-- Ticks off a task. If it repeats, also creates the next one, on the first
-- date on its schedule after today, so a task ticked off weeks late comes
-- back once rather than as a pile of overdue copies. With no due date, the
-- schedule starts from today. Returns the next due date, if there is one.
create function public.complete_task(p_task uuid)
returns date
language plpgsql security definer set search_path = public as $$
declare
  t       tasks;
  today   date := (now() at time zone 'Australia/Sydney')::date;
  next_on date;
  next_id uuid;
begin
  if public.current_user_role() is null then raise exception 'Please log in again.'; end if;

  select * into t from tasks
    where id = p_task and organization_id = public.current_org_id()
    for update;
  if not found or (public.current_user_role() = 'filler' and t.assigned_to is distinct from auth.uid()) then
    raise exception 'This task wasn''t found.';
  end if;
  if t.done_at is not null then return null; end if;   -- a double tap, or someone else just ticked it

  if t.repeats <> 'none' then
    next_on := coalesce(t.due_on, today);
    loop
      next_on := case t.repeats
        when 'daily'       then next_on + 1
        when 'weekdays'    then next_on + case extract(isodow from next_on)::int when 5 then 3 when 6 then 2 else 1 end
        when 'weekly'      then next_on + 7
        when 'fortnightly' then next_on + 14
        when 'monthly'     then (next_on + interval '1 month')::date   -- 31 January comes back on 28 February
        when 'yearly'      then (next_on + interval '1 year')::date
      end;
      exit when next_on > today;
    end loop;

    insert into tasks (organization_id, title, notes, category, priority, due_on, repeats,
                       assigned_to, client_id, location_id, machine_id, created_by)
    values (t.organization_id, t.title, t.notes, t.category, t.priority, next_on, t.repeats,
            t.assigned_to, t.client_id, t.location_id, t.machine_id, t.created_by)
    returning id into next_id;
  end if;

  update tasks set done_at = now(), done_by = auth.uid(), next_task_id = next_id where id = t.id;
  return next_on;
end $$;

-- Undoes a tick. A repeating task's next copy is removed again, unless that
-- one has been ticked off too, in which case this one stays done.
create function public.reopen_task(p_task uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  if public.current_user_role() is null then raise exception 'Please log in again.'; end if;

  select * into t from tasks
    where id = p_task and organization_id = public.current_org_id()
    for update;
  if not found or (public.current_user_role() = 'filler' and t.assigned_to is distinct from auth.uid()) then
    raise exception 'This task wasn''t found.';
  end if;
  if t.done_at is null then return; end if;

  if t.next_task_id is not null then
    delete from tasks where id = t.next_task_id and done_at is null;
    if not found then
      raise exception 'The next repeat of this task has already been ticked off, so this one can''t be reopened.';
    end if;
  end if;

  update tasks set done_at = null, done_by = null, next_task_id = null where id = t.id;
end $$;

revoke all on function public.complete_task(uuid) from public;
revoke all on function public.reopen_task(uuid) from public;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.reopen_task(uuid) to authenticated;
