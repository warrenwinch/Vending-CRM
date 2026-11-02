import Link from "next/link";
import { Suspense } from "react";
import { requireProfile, roleLabels } from "@/lib/auth";
import { todayInSydney } from "@/lib/au";
import { listDoneTasks, listOpenTasks } from "@/lib/tasks";
import { listMembers } from "@/lib/team";
import { isOnBoard, isTaskCategory, TASK_CATEGORIES, TASK_EDIT_ROLES, type Task } from "@/lib/task-types";
import { listFaults } from "@/lib/faults";
import type { Fault } from "@/lib/fault-types";
import { FaultCard, TaskCard } from "./task-card";
import { ScrollToColumn } from "./task-forms";

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <h1 className="page-title">Tasks</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading tasks…</p>}>
        <Tasks searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Column = { id: string; name: string; role?: string; tasks: Task[]; faults: Fault[] };

async function Tasks({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const { user, profile } = await requireProfile();
  const canEdit = TASK_EDIT_ROLES.includes(profile.role);
  const { show, type } = await searchParams;
  const view = show === "coming" ? "coming" : show === "done" ? "done" : "board";
  const category = typeof type === "string" && isTaskCategory(type) ? type : "";
  const today = todayInSydney();

  const [open, done, members, openFaults] = await Promise.all([
    listOpenTasks(),
    view === "done" ? listDoneTasks() : [],
    canEdit ? listMembers() : [],
    listFaults({ open: true }),
  ]);
  // Repairs given to someone go in their column. They have no Admin or Warehouse
  // type, so they only show when no type is chosen.
  const assignedFaults = category ? [] : openFaults.filter((f) => f.assigned_to);
  const matches = (t: Task) => !category || t.category === category;
  const onBoard = open.filter((t) => isOnBoard(t, today) && matches(t));
  const comingUp = open.filter((t) => !isOnBoard(t, today) && matches(t));
  const team = canEdit
    ? members.filter((m) => m.active).map((m) => ({ value: m.id, label: m.full_name }))
    : null;

  // One column per person, the person looking first. Someone who has left stays
  // on the board while they still have tasks, so nothing gets lost. Fillers only
  // see their own tasks, so they only get their own column.
  const people = canEdit
    ? members.filter((m) => m.active || onBoard.some((t) => t.assigned_to === m.id) || assignedFaults.some((f) => f.assigned_to === m.id))
    : [];
  const columns: Column[] = canEdit
    ? [...people]
        .sort((a, b) => Number(b.id === user.id) - Number(a.id === user.id))
        .map((m) => ({
          id: m.id,
          name: m.full_name,
          role: m.active ? roleLabels[m.role] : "No longer active",
          tasks: onBoard.filter((t) => t.assigned_to === m.id),
          faults: assignedFaults.filter((f) => f.assigned_to === m.id),
        }))
    : [{ id: user.id, name: profile.fullName || "My tasks", tasks: onBoard, faults: assignedFaults.filter((f) => f.assigned_to === user.id) }];
  const nobody = canEdit ? onBoard.filter((t) => !t.assigned_to) : [];
  if (nobody.length) columns.unshift({ id: "nobody", name: "Nobody yet", tasks: nobody, faults: [] });

  const href = (v: string) => {
    const qs = new URLSearchParams();
    if (v !== "board") qs.set("show", v);
    if (category) qs.set("type", category);
    return `/tasks${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Show">
          {[
            ["board", "Board"],
            ["coming", `Repeats coming up (${comingUp.length})`],
            ["done", "Done"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={href(value)}
              className={`rounded-full px-4 py-2 font-bold ${view === value ? "chip-active" : "chip"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/tasks" className="flex gap-2">
            {view !== "board" && <input type="hidden" name="show" value={view} />}
            <select name="type" defaultValue={category} aria-label="Admin or Warehouse" className="input">
              <option value="">All types</option>
              {TASK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Show
            </button>
          </form>
          {canEdit && (
            <Link href="/tasks/new" className="btn-primary">
              Add task
            </Link>
          )}
        </div>
      </div>

      {view === "board" && (
        <div className="-mx-4 flex snap-x items-start gap-3 overflow-x-auto px-4 pb-2">
          <ScrollToColumn />
          {columns.map((c) => (
            <section
              key={c.id}
              id={c.id}
              aria-label={c.name}
              className="flex w-[85vw] max-w-xs shrink-0 snap-start flex-col gap-2 rounded-2xl bg-zinc-100 p-3"
            >
              <header className="flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <h2 className="truncate font-bold">{c.name}</h2>
                  {c.role && <p className="text-xs text-zinc-500">{c.role}</p>}
                </div>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-bold">{c.tasks.length + c.faults.length}</span>
              </header>
              {c.faults.map((f) => (
                <FaultCard key={f.id} fault={f} team={team} />
              ))}
              {c.tasks.map((t) => (
                <TaskCard key={t.id} task={t} today={today} team={team} />
              ))}
              {c.tasks.length + c.faults.length === 0 && <p className="px-1 py-3 text-sm text-zinc-500">Nothing to do.</p>}
              {canEdit && c.id !== "nobody" && (
                <Link href={`/tasks/new?who=${c.id}`} className="px-1 text-sm font-medium underline">
                  Add a task for {c.name}
                </Link>
              )}
            </section>
          ))}
        </div>
      )}

      {view === "coming" && (
        <TaskGrid
          tasks={comingUp}
          today={today}
          empty="No repeating tasks waiting. They appear on the board on the day they're due."
        />
      )}
      {view === "done" && (
        <TaskGrid tasks={done.filter(matches)} today={today} empty="Nothing ticked off yet." />
      )}
    </>
  );
}

function TaskGrid({ tasks, today, empty }: { tasks: Task[]; today: string; empty: string }) {
  if (tasks.length === 0) {
    return <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} today={today} team={null} showPerson />
      ))}
    </div>
  );
}
