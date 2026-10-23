"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { MACHINE_EDIT_ROLES, isMachineStatus, isMachineType } from "@/lib/machine-types";
import { parseAud } from "@/lib/au";
import { getOpenPlacement } from "@/lib/placements";
import type { FormState } from "@/components/form-ui";

// Saves a new machine (machineId null) or changes an existing one.
// The database gives new machines their number (VM-001, VM-002...).
export async function saveMachine(
  machineId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { profile } = await requireRole(MACHINE_EDIT_ROLES);
  const canSeeCost = OFFICE_ROLES.includes(profile.role);

  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    manufacturer: get("manufacturer"),
    model: get("model"),
    serial_number: get("serial_number"),
    type: get("type"),
    payment_hardware: get("payment_hardware"),
    status: get("status"),
    purchase_date: get("purchase_date"),
    purchase_cost: get("purchase_cost"),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isMachineType(values.type)) return fail("Please choose the type of machine.");
  if (!isMachineStatus(values.status)) return fail("Please choose a status.");
  if (values.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(values.purchase_date)) {
    return fail("Please choose the purchase date from the calendar.");
  }

  const row: Record<string, string | number | null> = {
    manufacturer: values.manufacturer || null,
    model: values.model || null,
    serial_number: values.serial_number || null,
    type: values.type,
    payment_hardware: values.payment_hardware || null,
    status: values.status,
    purchase_date: values.purchase_date || null,
  };

  // Installed comes from placing a machine. While it's at a location its
  // status is changed with Move / Take out, not here.
  const placed = machineId ? await getOpenPlacement(machineId) : null;
  if (placed) delete row.status;
  else if (values.status === "installed") {
    return fail("Place the machine at a location to make it Installed.");
  }

  // Only Administrators and Managers see or change what a machine cost.
  if (canSeeCost) {
    if (values.purchase_cost) {
      const cost = parseAud(values.purchase_cost);
      if (cost === null) return fail("Please enter the purchase cost in dollars, for example 4500 or 4,500.00.");
      row.purchase_cost = cost;
    } else {
      row.purchase_cost = null;
    }
  }

  const supabase = await createClient();
  const { data, error } = machineId
    ? await supabase.from("machines").update(row).eq("id", machineId).select("id")
    : await supabase.from("machines").insert(row).select("id");

  if (error) return fail(`Could not save: ${error.message}`);
  if (!data?.length) return fail("Could not save this machine. It may have been removed.");

  redirect(`/machines/${data[0].id}`);
}
