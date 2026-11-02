import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { todayInSydney } from "@/lib/au";
import { formatDateTime } from "@/lib/fault-types";
import { isUuid } from "@/lib/ids";
import { getTask } from "@/lib/tasks";
import { repeatLabel, TASK_EDIT_ROLES } from "@/lib/task-types";
import { TaskBadges } from "../task-card";
import { DeleteTaskButton, TaskDoneButton } from "../task-forms";

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <TaskDetails params={params} />
    </Suspense>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="sm:col-span-2">{children}</dd>
    </div>
  );
}

async function TaskDetails({ params }: Pick<PageProps<"/tasks/[id]">, "params">) {
  const { profile } = await requireProfile();
  const canEdit = TASK_EDIT_ROLES.includes(profile.role);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const task = await getTask(id);
  if (!task) notFound();
  const today = todayInSydney();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link href="/tasks" className="text-sm font-medium text-zinc-500 underline">
            Tasks
          </Link>
          <h1 className="page-title break-words">{task.title}</h1>
          <TaskBadges task={task} today={today} />
        </div>
        {canEdit && (
          <Link href={`/tasks/${task.id}/edit`} className="btn-secondary">
            Edit
          </Link>
        )}
      </div>

      <dl className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
        <Row label="Who it's for">{task.assigned_name ?? <span className="text-zinc-400">Nobody yet</span>}</Row>
        {task.repeats !== "none" && <Row label="Repeats">{repeatLabel(task.repeats)}</Row>}
        {task.client_name && (
          <Row label="Customer">
            <Link href={`/clients/${task.client_id}`} className="underline">
              {task.client_name}
            </Link>
          </Row>
        )}
        {task.site_name && (
          <Row label="Site">
            <Link href={`/locations/${task.location_id}`} className="underline">
              {task.site_name}
            </Link>
          </Row>
        )}
        {task.machine_number && (
          <Row label="Machine">
            <Link href={`/machines/${task.machine_id}`} className="font-mono font-semibold underline">
              {task.machine_number}
            </Link>
          </Row>
        )}
        {task.notes && (
          <Row label="Notes">
            <span className="whitespace-pre-line">{task.notes}</span>
          </Row>
        )}
        {task.created_by_name && <Row label="Added by">{task.created_by_name}</Row>}
        {task.done_at && (
          <Row label="Done">
            {formatDateTime(task.done_at)}
            {task.done_by_name && ` by ${task.done_by_name}`}
          </Row>
        )}
      </dl>

      <TaskDoneButton taskId={task.id} done={!!task.done_at} big />

      {canEdit && <DeleteTaskButton taskId={task.id} repeats={task.repeats !== "none"} />}
    </>
  );
}
