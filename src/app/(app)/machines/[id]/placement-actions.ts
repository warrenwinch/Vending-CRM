"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { getMachine } from "@/lib/machines";
import { getOpenPlacement, placeName } from "@/lib/placements";
import { isUuid } from "@/lib/ids";
import { formatDate, todayInSydney } from "@/lib/au";
import type { FormState } from "@/components/form-ui";

// The date a move happened: a real date, not in the future, and not
// before the machine arrived where it is now.
function checkDate(date: string, since: string | undefined) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Please choose the date from the calendar.";
  if (date > todayInSydney()) return "The date can't be in the future.";
  if (since && date < since) return `The date can't be before ${formatDate(since)}, when it arrived at its current site.`;
  return null;
}

// The move functions' own messages (code P0001) are written for people;
// anything else gets a lead-in. A missing function means 12 hasn't been run.
function dbProblem(lead: string, error: { code?: string; message: string }) {
  if (error.code === "P0001") return error.message;
  if (error.code === "PGRST202") return `${lead}: the database needs updating (run 12_atomic_machine_moves.sql in Supabase).`;
  return `${lead}: ${error.message}`;
}

// Places a machine at a location, or moves it. Moving closes the current
// placement (sets its end date) and opens a new one, so history is never lost.
export async function placeMachine(machineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(MACHINE_EDIT_ROLES);

  const values = {
    location_id: String(formData.get("location_id") ?? ""),
    position: String(formData.get("position") ?? "").trim().replace(/\s+/g, " "),
    date: String(formData.get("date") ?? ""),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(machineId)) return fail("This machine wasn't found.");
  if (!isUuid(values.location_id)) return fail("Please choose a location.");
  if (values.position.length > 200) return fail("Please keep the position under 200 characters.");

  const machine = await getMachine(machineId);
  if (!machine) return fail("This machine wasn't found.");
  if (machine.status === "retired") return fail("This machine is retired. Change its status before placing it.");

  // Moving within the same site (Level 4N to Level 2S) is a move too; the same spot isn't.
  const current = await getOpenPlacement(machineId);
  const samePosition = (current?.position ?? "").toLowerCase() === values.position.toLowerCase();
  if (current?.location_id === values.location_id && samePosition) {
    return fail(`It's already at ${placeName(current)}.`);
  }

  const dateProblem = checkDate(values.date, current?.started_on);
  if (dateProblem) return fail(dateProblem);

  // One database step (12_atomic_machine_moves.sql): closes where it is now,
  // opens the new placement and sets Installed, or saves none of it.
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_machine", {
    p_machine_id: machineId,
    p_location_id: values.location_id,
    p_position: values.position,
    p_date: values.date,
    p_from_placement: current?.id ?? null,
  });
  if (error) return fail(dbProblem("Could not place the machine", error));

  redirect(`/machines/${machineId}`);
}

// Takes a machine out of its location (back to storage, or off for repair).
export async function takeOutMachine(machineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(MACHINE_EDIT_ROLES);

  const values = {
    date: String(formData.get("date") ?? ""),
    status: String(formData.get("status") ?? ""),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(machineId)) return fail("This machine wasn't found.");
  if (values.status !== "in_storage" && values.status !== "needs_repair") {
    return fail("Please choose what happens to the machine.");
  }

  const current = await getOpenPlacement(machineId);
  if (!current) return fail("This machine isn't at a location at the moment.");

  const dateProblem = checkDate(values.date, current.started_on);
  if (dateProblem) return fail(dateProblem);

  const supabase = await createClient();
  const { error } = await supabase.rpc("take_out_machine", {
    p_machine_id: machineId,
    p_date: values.date,
    p_status: values.status,
    p_from_placement: current.id,
  });
  if (error) return fail(dbProblem("Could not take the machine out", error));

  redirect(`/machines/${machineId}`);
}
