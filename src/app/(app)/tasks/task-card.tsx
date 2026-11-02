// One task on the board or in a list.
import Link from "next/link";
import { formatDate } from "@/lib/au";
import { categoryLabel as faultCategoryLabel, formatDateTime, type Fault } from "@/lib/fault-types";
import { categoryLabel, repeatBadge, type Task } from "@/lib/task-types";
import { FaultAssignSelect, TaskAssignSelect, TaskDoneButton } from "./task-forms";

// A repair given to this person. It leaves the board by itself once it's fixed,
// which is done on the fault's own page because that asks when and what was done.
export function FaultCard({ fault, team }: { fault: Fault; team: { value: string; label: string }[] | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-l-8 border-zinc-200 border-l-bar bg-white p-3">
      <Link href={`/faults/${fault.id}`} className="flex flex-col gap-1 hover:underline">
        <span className="font-bold break-words">{faultCategoryLabel(fault.category)}</span>
        <span className="text-sm text-zinc-600">{[fault.site_name, fault.machine_number].filter(Boolean).join(" · ")}</span>
      </Link>
      <div className="flex flex-wrap gap-1">
        <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-bold text-leaf-deep">Fault</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            fault.severity === "not_working" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"
          }`}
        >
          {fault.severity === "not_working" ? "Not working" : "Partly working"}
        </span>
      </div>
      {team && <FaultAssignSelect faultId={fault.id} assignedTo={fault.assigned_to} team={team} />}
      <Link href={`/faults/${fault.id}`} className="btn-small">
        Open fault
      </Link>
    </div>
  );
}

export function DueBadge({ dueOn, today }: { dueOn: string | null; today: string }) {
  if (!dueOn) return null;
  const style = dueOn < today ? "bg-red-100 text-red-900" : dueOn === today ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-700";
  const text = dueOn < today ? `Overdue since ${formatDate(dueOn)}` : dueOn === today ? "Due today" : `Due ${formatDate(dueOn)}`;
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${style}`}>{text}</span>;
}

export function TaskBadges({ task, today }: { task: Task; today: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {!task.done_at && <DueBadge dueOn={task.due_on} today={today} />}
      {task.priority === "high" && (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-900">High</span>
      )}
      {task.category && (
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900">{categoryLabel(task.category)}</span>
      )}
      {task.repeats !== "none" && (
        <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-medium text-leaf-deep">{repeatBadge(task.repeats)}</span>
      )}
    </div>
  );
}

export function TaskCard({
  task,
  today,
  team,
  showPerson,
}: {
  task: Task;
  today: string;
  team: { value: string; label: string }[] | null; // null: this person can't reassign
  showPerson?: boolean;
}) {
  const about = [task.client_name, task.site_name, task.machine_number].filter(Boolean).join(" · ");
  const edge = task.done_at || !task.due_on || task.due_on > today ? "border-zinc-200" : task.due_on < today ? "border-red-600" : "border-amber-500";

  return (
    <div className={`flex flex-col gap-2 rounded-xl border-2 border-l-8 bg-white p-3 ${edge}`}>
      <Link href={`/tasks/${task.id}`} className="flex flex-col gap-1 hover:underline">
        <span className="font-bold break-words">{task.title}</span>
        {about && <span className="text-sm text-zinc-600">{about}</span>}
      </Link>
      <TaskBadges task={task} today={today} />
      {showPerson && <p className="text-sm text-zinc-600">{task.assigned_name ?? "Nobody yet"}</p>}
      {task.done_at && (
        <p className="text-xs text-zinc-500">
          Done {formatDateTime(task.done_at)}
          {task.done_by_name && ` by ${task.done_by_name}`}
        </p>
      )}
      {!task.done_at && team && <TaskAssignSelect taskId={task.id} assignedTo={task.assigned_to} team={team} />}
      <TaskDoneButton taskId={task.id} done={!!task.done_at} />
    </div>
  );
}
