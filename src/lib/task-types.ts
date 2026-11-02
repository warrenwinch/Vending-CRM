// Tasks: the types and wording, safe to use on any screen.
import type { Role } from "@/lib/auth-types";

// Who can add, edit, assign and delete. Fillers only see and tick off their own.
export const TASK_EDIT_ROLES: Role[] = ["administrator", "manager", "warehouse"];

export const TASK_CATEGORIES = [
  { value: "admin", label: "Admin" },
  { value: "warehouse", label: "Warehouse" },
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number]["value"];

export const TASK_PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number]["value"];

export const TASK_REPEATS = [
  { value: "none", label: "Doesn't repeat", badge: "" },
  { value: "daily", label: "Every day", badge: "Daily" },
  { value: "weekdays", label: "Every weekday (Mon–Fri)", badge: "Weekdays" },
  { value: "weekly", label: "Every week", badge: "Weekly" },
  { value: "fortnightly", label: "Every fortnight", badge: "Fortnightly" },
  { value: "monthly", label: "Every month", badge: "Monthly" },
  { value: "yearly", label: "Every year", badge: "Yearly" },
] as const;
export type TaskRepeat = (typeof TASK_REPEATS)[number]["value"];

export const isTaskCategory = (v: string): v is TaskCategory => TASK_CATEGORIES.some((c) => c.value === v);
export const isTaskPriority = (v: string): v is TaskPriority => TASK_PRIORITIES.some((p) => p.value === v);
export const isTaskRepeat = (v: string): v is TaskRepeat => TASK_REPEATS.some((r) => r.value === v);

export const categoryLabel = (c: TaskCategory) => TASK_CATEGORIES.find((x) => x.value === c)!.label;
export const repeatLabel = (r: TaskRepeat) => TASK_REPEATS.find((x) => x.value === r)!.label;
export const repeatBadge = (r: TaskRepeat) => TASK_REPEATS.find((x) => x.value === r)!.badge;

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  category: TaskCategory | null;
  priority: TaskPriority;
  due_on: string | null;
  repeats: TaskRepeat;
  assigned_to: string | null;
  client_id: string | null;
  location_id: string | null;
  machine_id: string | null;
  done_at: string | null;
  client_name: string | null; // empty for Warehouse and Fillers, who can't see customers
  site_name: string | null;
  machine_number: string | null;
  assigned_name: string | null;
  done_by_name: string | null;
  created_by_name: string | null;
};

// A repeating task stays off the board until its due day, then stays on it
// until it's ticked off, so a missed one can't slip away unseen.
export function isOnBoard(task: Pick<Task, "repeats" | "due_on">, today: string) {
  return task.repeats === "none" || !task.due_on || task.due_on <= today;
}
