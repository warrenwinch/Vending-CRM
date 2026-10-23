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
  let cost: number | null = null;
  if (canSeeCost && values.purchase_cost) {
    cost = parseAud(values.purchase_cost);
    if (cost === null) return fail("Please enter the purchase cost in dollars, for example 4500 or 4,500.00.");
  }

  const supabase = await createClient();
  const { data, error } = machineId
    ? await supabase.from("machines").update(row).eq("id", machineId).select("id")
    : await supabase.from("machines").insert(row).select("id");

  if (error) return fail(`Could not save: ${error.message}`);
  if (!data?.length) return fail("Could not save this machine. It may have been removed.");
  const savedId = data[0].id as string;

  // The cost is kept in its own table, private to Administrators and Managers.
  if (canSeeCost) {
    const { error: costError } = await supabase
      .from("machine_costs")
      .upsert({ machine_id: savedId, purchase_cost: cost }, { onConflict: "machine_id" });
    if (costError) {
      // The machine itself is saved; say so, so it isn't added a second time.
      return {
        error: `The machine was saved, but its purchase cost wasn't (${costError.message}). Don't save this form again: open the machine from Machines and edit its cost there.`,
        values,
      };
    }
  }

  redirect(`/machines/${savedId}`);
}
