"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { assignTask, createTask, deleteTask, toggleTaskDone, updateTask } from "./actions";
import { assignFault } from "../faults/actions";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField, type FormState } from "@/components/form-ui";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_REPEATS } from "@/lib/task-types";

type Option = { value: string; label: string };

export type TaskChoices = {
  team: Option[];
  clients: Option[] | null; // null: this person can't see customers
  sites: Option[];
  machines: Option[];
};

export function TaskForm({
  taskId,
  initial,
  choices,
  back,
}: {
  taskId?: string;
  initial: Record<string, string>;
  choices: TaskChoices;
  back: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    taskId ? updateTask.bind(null, taskId) : createTask,
    {},
  );
  const v = state.values ?? initial;

  // After a failed save React resets the form, and drop-downs go back to the
  // choice they first drew with. The key redraws them with what was picked.
  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Task" name="title" maxLength={200} placeholder="e.g. Order more cups" defaultValue={v.title ?? ""} required />
      <TextAreaField label="Notes (optional)" name="notes" maxLength={2000} defaultValue={v.notes ?? ""} />
      <SelectField
        label="Who it's for"
        name="assigned_to"
        options={[{ value: "", label: "Nobody yet" }, ...choices.team]}
        defaultValue={v.assigned_to ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due date" name="due_on" type="date" defaultValue={v.due_on ?? ""} />
        <SelectField label="Repeats" name="repeats" options={[...TASK_REPEATS]} defaultValue={v.repeats ?? "none"} />
        <SelectField label="Priority" name="priority" options={[...TASK_PRIORITIES]} defaultValue={v.priority ?? "normal"} />
        <SelectField
          label="Admin or Warehouse (optional)"
          name="category"
          options={[{ value: "", label: "Neither" }, ...TASK_CATEGORIES]}
          defaultValue={v.category ?? ""}
        />
      </div>
      <p className="text-sm text-zinc-600">A repeating task shows on the board on the day it&apos;s due, and stays there until it&apos;s ticked off.</p>

      <fieldset className="flex flex-col gap-4 rounded-2xl border-2 border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-bold text-ink">What it&apos;s about (optional)</legend>
        {choices.clients && (
          <SelectField
            label="Customer"
            name="client_id"
            options={[{ value: "", label: "No customer" }, ...choices.clients]}
            defaultValue={v.client_id ?? ""}
          />
        )}
        <SelectField
          label="Site"
          name="location_id"
          options={[{ value: "", label: "No site" }, ...choices.sites]}
          defaultValue={v.location_id ?? ""}
        />
        <SelectField
          label="Machine"
          name="machine_id"
          options={[{ value: "", label: "No machine" }, ...choices.machines]}
          defaultValue={v.machine_id ?? ""}
        />
      </fieldset>

      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>{taskId ? "Save" : "Add task"}</SubmitButton>
        <Link href={back} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

// The tick button on each card. Undoing it is the same button on a done task.
export function TaskDoneButton({ taskId, done, big }: { taskId: string; done: boolean; big?: boolean }) {
  const [state, formAction, pending] = useActionState<FormState>(toggleTaskDone.bind(null, taskId, done), {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button type="submit" disabled={pending} className={big ? "btn-primary" : "btn-small"}>
        {pending ? "Saving…" : done ? "Reopen" : "Done"}
      </button>
      {state.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
      {big && state.message && <span aria-live="polite" className="text-sm text-leaf-deep">{state.message}</span>}
    </form>
  );
}

// Coming from a person's button on Home: slides the board across to their column.
export function ScrollToColumn() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ inline: "start", block: "nearest" });
  }, []);
  return null;
}

// Moves a task to another person's column as soon as a name is picked.
export function TaskAssignSelect({ taskId, assignedTo, team }: { taskId: string; assignedTo: string | null; team: Option[] }) {
  return <AssignSelect action={assignTask.bind(null, taskId)} assignedTo={assignedTo} team={team} />;
}

// The same for a repair; giving it to nobody takes it off the board.
export function FaultAssignSelect({ faultId, assignedTo, team }: { faultId: string; assignedTo: string | null; team: Option[] }) {
  return <AssignSelect action={assignFault.bind(null, faultId)} assignedTo={assignedTo} team={team} />;
}

function AssignSelect({
  action,
  assignedTo,
  team,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  assignedTo: string | null;
  team: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [open, setOpen] = useState(false);

  // Names listed on the card rather than a drop-down, whose list opens over the
  // Done button: one tap on a name could also tick the task off.
  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => setOpen(true)} className="btn-small">
          Give to…
        </button>
        {state.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg bg-zinc-100 p-2">
      <p className="text-xs font-bold text-zinc-600">Give to</p>
      {[{ value: "", label: "Nobody yet" }, ...team]
        .filter((o) => o.value !== (assignedTo ?? ""))
        .map((o) => (
          <button key={o.value} type="submit" name="assigned_to" value={o.value} disabled={pending} className="btn-small">
            {o.label}
          </button>
        ))}
      <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium underline">
        Cancel
      </button>
    </form>
  );
}

export function DeleteTaskButton({ taskId, repeats }: { taskId: string; repeats: boolean }) {
  return (
    <form
      action={deleteTask.bind(null, taskId)}
      onSubmit={(e) => {
        const question = repeats ? "Delete this task? If it's still to do, it stops repeating." : "Delete this task?";
        if (!confirm(`${question} This can't be undone.`)) e.preventDefault();
      }}
      className="border-t border-zinc-200 pt-4"
    >
      <button type="submit" className="text-sm font-medium text-red-700 underline">
        Delete this task
      </button>
    </form>
  );
}
