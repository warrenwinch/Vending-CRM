"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { getMachine } from "@/lib/machines";
import { getOpenPlacement } from "@/lib/placements";
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

// Places a machine at a location, or moves it. Moving closes the current
// placement (sets its end date) and opens a new one, so history is never lost.
export async function placeMachine(machineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(MACHINE_EDIT_ROLES);

  const values = {
    location_id: String(formData.get("location_id") ?? ""),
    date: String(formData.get("date") ?? ""),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(machineId)) return fail("This machine wasn't found.");
  if (!isUuid(values.location_id)) return fail("Please choose a location.");

  const machine = await getMachine(machineId);
  if (!machine) return fail("This machine wasn't found.");
  if (machine.status === "retired") return fail("This machine is retired. Change its status before placing it.");

  const current = await getOpenPlacement(machineId);
  if (current?.location_id === values.location_id) return fail(`It's already at ${current.site_name}.`);

  const dateProblem = checkDate(values.date, current?.started_on);
  if (dateProblem) return fail(dateProblem);

  const supabase = await createClient();

  // 1. Close where it is now (if anywhere).
  if (current) {
    const { data, error } = await supabase
      .from("machine_placements")
      .update({ ended_on: values.date })
      .eq("id", current.id)
      .is("ended_on", null)
      .select("id");
    if (error) return fail(`Could not move the machine: ${error.message}`);
    if (!data.length) return fail("Someone else just moved this machine. Please reload the page and try again.");
  }

  // 2. Open the new placement. If that fails, put the old one back as it was.
  const { error: placeError } = await supabase
    .from("machine_placements")
    .insert({ machine_id: machineId, location_id: values.location_id, started_on: values.date });
  if (placeError) {
    if (current) {
      await supabase.from("machine_placements").update({ ended_on: null }).eq("id", current.id);
    }
    return fail(`Could not place the machine: ${placeError.message}`);
  }

  // 3. A placed machine is installed.
  if (machine.status !== "installed") {
    await supabase.from("machines").update({ status: "installed" }).eq("id", machineId);
  }

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
  const { data, error } = await supabase
    .from("machine_placements")
    .update({ ended_on: values.date })
    .eq("id", current.id)
    .is("ended_on", null)
    .select("id");
  if (error) return fail(`Could not take the machine out: ${error.message}`);
  if (!data.length) return fail("Someone else just moved this machine. Please reload the page and try again.");

  await supabase.from("machines").update({ status: values.status }).eq("id", machineId);

  redirect(`/machines/${machineId}`);
}
