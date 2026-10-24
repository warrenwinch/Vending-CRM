"use server";

import { createClient } from "@/lib/supabase/server";
import { withoutFields } from "@/lib/csv";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import {
  MAX_IMPORT_ROWS,
  checkRow,
  findDuplicateSerials,
  type MachineInsert,
  type RawRow,
} from "@/lib/machine-import";

export type ImportResult = {
  error?: string;
  rowErrors?: { row: number; errors: string[] }[];
  imported?: { count: number; first: string; last: string };
};

// Checks every row again (never trust the browser), then saves them all in
// one go: either every machine is added or none are.
export async function importMachines(rows: RawRow[]): Promise<ImportResult> {
  const { profile } = await requireRole(MACHINE_EDIT_ROLES);
  const allowCost = OFFICE_ROLES.includes(profile.role);

  if (!Array.isArray(rows) || rows.length === 0) return { error: "The file has no machines in it." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Please import at most ${MAX_IMPORT_ROWS} machines at a time.` };
  }

  const supabase = await createClient();

  // Serial numbers already in the system.
  const { data: existing, error: loadError } = await supabase
    .from("machines")
    .select("machine_number, serial_number")
    .not("serial_number", "is", null);
  if (loadError) return { error: `Could not check existing machines: ${loadError.message}` };
  const known = new Map(existing.map((m) => [String(m.serial_number).trim().toLowerCase(), m.machine_number]));

  const dupes = findDuplicateSerials(rows);
  const rowErrors: { row: number; errors: string[] }[] = [];
  const inserts: MachineInsert[] = [];

  rows.forEach((raw, i) => {
    const { errors, row } = checkRow(raw, { allowCost });
    if (dupes.has(i)) errors.push(dupes.get(i)!);
    const serial = (raw.serial_number ?? "").trim().toLowerCase();
    if (serial && known.has(serial)) {
      errors.push(`Serial number “${raw.serial_number?.trim()}” is already on ${known.get(serial)}.`);
    }
    // Row numbers match the spreadsheet: row 1 is the headings.
    if (errors.length || !row) rowErrors.push({ row: i + 2, errors });
    else inserts.push(row);
  });

  if (rowErrors.length) return { rowErrors };

  // Machines first; purchase costs go in their own private table afterwards.
  const machines = withoutFields(inserts, ["purchase_cost"]);
  const { data, error } = await supabase.from("machines").insert(machines).select("id, machine_number");
  if (error) return { error: `Could not save the machines: ${error.message}` };

  // The database returns the new machines in the same order as the file.
  const costs = inserts
    .map((m, i) => ({ machine_id: data[i]?.id as string, purchase_cost: m.purchase_cost ?? null }))
    .filter((c) => c.machine_id && c.purchase_cost !== null);
  if (allowCost && costs.length) {
    const { error: costError } = await supabase.from("machine_costs").insert(costs);
    if (costError) {
      return {
        error: `The ${data.length} machines were added (${data[0]?.machine_number} to ${data[data.length - 1]?.machine_number}), but their purchase costs weren't saved (${costError.message}). Don't import this file again: add the costs on each machine's page.`,
      };
    }
  }

  return {
    imported: {
      count: data.length,
      first: data[0]?.machine_number ?? "",
      last: data[data.length - 1]?.machine_number ?? "",
    },
  };
}
