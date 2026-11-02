import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { TASK_EDIT_ROLES } from "@/lib/task-types";
import { loadTaskChoices } from "../choices";
import { TaskForm } from "../task-forms";

export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <>
      <div>
        <Link href="/tasks" className="text-sm font-medium text-zinc-500 underline">
          Tasks
        </Link>
        <h1 className="page-title">Add a task</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewTask searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewTask({ searchParams }: Pick<PageProps<"/tasks/new">, "searchParams">) {
  const { profile } = await requireRole(TASK_EDIT_ROLES);
  const { who } = await searchParams;
  const choices = await loadTaskChoices(profile.role);
  return <TaskForm initial={{ assigned_to: isUuid(who) ? who : "" }} choices={choices} back="/tasks" />;
}
