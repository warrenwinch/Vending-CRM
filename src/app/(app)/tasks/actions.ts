"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole, OFFICE_ROLES } from "@/lib/auth";
import { formatDate } from "@/lib/au";
import { isUuid } from "@/lib/ids";
import { isTaskCategory, isTaskPriority, isTaskRepeat, TASK_EDIT_ROLES } from "@/lib/task-types";
import type { FormState } from "@/components/form-ui";

// Checks the add/edit form. Returns what to save, or the message to show.
function readForm(formData: FormData) {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    title: get("title"),
    notes: get("notes"),
    category: get("category"),
    priority: get("priority"),
    due_on: get("due_on"),
    repeats: get("repeats"),
    assigned_to: get("assigned_to"),
    client_id: get("client_id"),
    location_id: get("location_id"),
    machine_id: get("machine_id"),
  };
  let error = "";
  if (values.title.length < 2) error = "Please say what the task is.";
  else if (values.title.length > 200) error = "Please keep the task under 200 characters.";
  else if (values.notes.length > 2000) error = "Please keep the notes under 2000 characters.";
  else if (values.category && !isTaskCategory(values.category)) error = "Please choose Admin, Warehouse or neither.";
  else if (!isTaskPriority(values.priority)) error = "Please choose a priority.";
  else if (!isTaskRepeat(values.repeats)) error = "Please choose how often it repeats.";
  else if (values.due_on && !/^\d{4}-\d{2}-\d{2}$/.test(values.due_on)) error = "Please enter a valid due date.";
  else if (values.repeats !== "none" && !values.due_on) error = "A repeating task needs a due date, so the board knows which day to show it.";
  else if ([values.assigned_to, values.client_id, values.location_id, values.machine_id].some((id) => id && !isUuid(id))) {
    error = "One of the choices wasn't recognised. Please choose it again.";
  }
  return { values, error };
}

const toRow = (v: ReturnType<typeof readForm>["values"]) => ({
  title: v.title,
  notes: v.notes || null,
  category: v.category || null,
  priority: v.priority,
  due_on: v.due_on || null,
  repeats: v.repeats,
  assigned_to: v.assigned_to || null,
  location_id: v.location_id || null,
  machine_id: v.machine_id || null,
});

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireRole(TASK_EDIT_ROLES);
  const { values, error: invalid } = readForm(formData);
  if (invalid) return { error: invalid, values };

  // Only the office can see customers, so only the office can link one.
  const clientId = OFFICE_ROLES.includes(profile.role) ? values.client_id || null : null;
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({ ...toRow(values), client_id: clientId });
  if (error) return { error: `Could not save the task: ${error.message}`, values };
  redirect("/tasks");
}

export async function updateTask(taskId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireRole(TASK_EDIT_ROLES);
  const { values, error: invalid } = readForm(formData);
  if (invalid) return { error: invalid, values };
  if (!isUuid(taskId)) return { error: "This task wasn't found.", values };

  // Warehouse doesn't get the customer drop-down, so leave any link as it is.
  const row = OFFICE_ROLES.includes(profile.role) ? { ...toRow(values), client_id: values.client_id || null } : toRow(values);
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update(row).eq("id", taskId).select("id");
  if (error) return { error: `Could not save the task: ${error.message}`, values };
  if (!data.length) return { error: "This task wasn't found.", values };
  revalidatePath("/tasks");
  redirect(`/tasks/${taskId}`);
}

// Ticks a task off, or undoes the tick. Fillers can do this for their own tasks;
// the database checks that, and makes the next copy of a repeating task.
export async function toggleTaskDone(taskId: string, done: boolean): Promise<FormState> {
  await requireProfile();
  if (!isUuid(taskId)) return { error: "This task wasn't found." };

  const supabase = await createClient();
  const { data, error } = done
    ? await supabase.rpc("reopen_task", { p_task: taskId })
    : await supabase.rpc("complete_task", { p_task: taskId });
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (done) return { message: "Reopened." };
  return { message: data ? `Done. It comes back on ${formatDate(data as string)}.` : "Done." };
}

// Gives a task to someone else, for example when the person who had it calls in sick.
export async function assignTask(taskId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(TASK_EDIT_ROLES);
  const assignedTo = String(formData.get("assigned_to") ?? "");
  if (!isUuid(taskId) || (assignedTo && !isUuid(assignedTo))) return { error: "Please choose a team member." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ assigned_to: assignedTo || null })
    .eq("id", taskId)
    .select("id");
  if (error) return { error: `Could not save: ${error.message}` };
  if (!data.length) return { error: "This task wasn't found." };
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return {};
}

export async function deleteTask(taskId: string) {
  await requireRole(TASK_EDIT_ROLES);
  if (!isUuid(taskId)) return;
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath("/tasks");
  redirect("/tasks");
}
