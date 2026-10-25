"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import type { FormState } from "@/components/form-ui";

// The plan details shared by adding and editing.
function readPlan(formData: FormData) {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    task: get("task").replace(/\s+/g, " "),
    every_count: get("every_count"),
    every_unit: get("every_unit"),
    next_due: get("next_due"),
    notes: get("notes"),
  };
  const count = Number(values.every_count);
  let error: string | null = null;
  if (values.task.length < 2) error = "Please say what the job is.";
  else if (values.task.length > 120) error = "Please keep the job name under 120 characters.";
  else if (!Number.isInteger(count) || count < 1 || count > 104) error = "Please enter how often, as a whole number from 1 to 104.";
  else if (values.every_unit !== "weeks" && values.every_unit !== "months") error = "Please choose weeks or months.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.next_due)) error = "Please choose the due date from the calendar.";
  else if (values.notes.length > 1000) error = "Please keep the notes under 1000 characters.";
  const row = {
    task: values.task,
    every_count: count,
    every_unit: values.every_unit as "weeks" | "months",
    next_due: values.next_due,
    notes: values.notes || null,
  };
  return { values, error, row };
}

// Adds the same job to every machine ticked (one plan each).
export async function addPlans(back: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OFFICE_ROLES);
  const { values, error, row } = readPlan(formData);
  const machineIds = [...new Set(formData.getAll("machine_id").map(String))].filter(isUuid);
  const keep = { ...values, machine_ids: machineIds.join(",") };
  if (!machineIds.length) return { error: "Please tick at least one machine.", values: keep };
  if (error) return { error, values: keep };

  const supabase = await createClient();
  const { error: saveError } = await supabase
    .from("maintenance_plans")
    .insert(machineIds.map((machine_id) => ({ ...row, machine_id })));
  if (saveError) return { error: `Could not save: ${saveError.message}`, values: keep };

  redirect(back.startsWith("/machines/") ? back : "/maintenance?show=all");
}

export async function updatePlan(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OFFICE_ROLES);
  const { values, error, row } = readPlan(formData);
  if (!isUuid(planId)) return { error: "This maintenance job wasn't found.", values };
  if (error) return { error, values };

  const supabase = await createClient();
  const { error: saveError } = await supabase.from("maintenance_plans").update(row).eq("id", planId);
  if (saveError) return { error: `Could not save: ${saveError.message}`, values };
  redirect(`/maintenance/${planId}`);
}

// Stops a regular job. Its history stays on the machine.
export async function deletePlan(planId: string, machineId: string) {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(planId)) return;
  const supabase = await createClient();
  await supabase.from("maintenance_plans").delete().eq("id", planId);
  redirect(isUuid(machineId) ? `/machines/${machineId}` : "/maintenance");
}

// Anyone can mark a job done; the database records it and sets the next due date.
export async function markDone(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireProfile();
  const values = {
    done_on: String(formData.get("done_on") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
  };
  if (!isUuid(planId)) return { error: "This maintenance job wasn't found.", values };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.done_on)) return { error: "Please choose the date from the calendar.", values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_maintenance_done", {
    p_plan: planId,
    p_done_on: values.done_on,
    p_notes: values.notes || null,
  });
  if (error) {
    if (error.code === "P0001") return { error: error.message, values };
    if (error.code === "PGRST202") return { error: "The database needs updating (run 14_maintenance.sql in Supabase).", values };
    return { error: `Could not save: ${error.message}`, values };
  }
  redirect(`/maintenance/${planId}?done=1`);
}
