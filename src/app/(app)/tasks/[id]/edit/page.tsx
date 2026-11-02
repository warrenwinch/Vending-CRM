import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { getTask } from "@/lib/tasks";
import { TASK_EDIT_ROLES } from "@/lib/task-types";
import { loadTaskChoices } from "../../choices";
import { TaskForm } from "../../task-forms";

export default function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  return (
    <>
      <div>
        <Link href="/tasks" className="text-sm font-medium text-zinc-500 underline">
          Tasks
        </Link>
        <h1 className="page-title">Edit task</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditTask params={params} />
      </Suspense>
    </>
  );
}

async function EditTask({ params }: Pick<PageProps<"/tasks/[id]/edit">, "params">) {
  const { profile } = await requireRole(TASK_EDIT_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const task = await getTask(id);
  if (!task) notFound();
  const choices = await loadTaskChoices(profile.role, task);

  return (
    <TaskForm
      taskId={task.id}
      initial={{
        title: task.title,
        notes: task.notes ?? "",
        category: task.category ?? "",
        priority: task.priority,
        due_on: task.due_on ?? "",
        repeats: task.repeats,
        assigned_to: task.assigned_to ?? "",
        client_id: task.client_id ?? "",
        location_id: task.location_id ?? "",
        machine_id: task.machine_id ?? "",
      }}
      choices={choices}
      back={`/tasks/${task.id}`}
    />
  );
}
