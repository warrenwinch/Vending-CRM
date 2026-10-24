"use server";

import { createClient } from "@/lib/supabase/server";
import { withoutFields } from "@/lib/csv";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { listLocations } from "@/lib/locations";
import { todayInSydney } from "@/lib/au";
import {
  MAX_IMPORT_ROWS,
  checkRow,
  findDuplicateSerials,
  findDuplicateSpots,
  type MachineInsert,
  type PlacementInsert,
  type RawRow,
} from "@/lib/machine-import";

export type ImportResult = {
  error?: string;
  rowErrors?: { row: number; errors: string[] }[];
  imported?: { count: number; first: string; last: string; placed: number };
};

// Checks every row again (never trust the browser), saves the machines in
// one go, then their purchase costs, then places those that name a site.
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

  // Sites machines can be placed at (not lost).
  const sites = (await listLocations({}))
    .filter((l) => l.status !== "lost")
    .map((l) => ({ id: l.id, site_name: l.site_name, client_name: l.client_name }));
  const today = todayInSydney();

  const dupes = findDuplicateSerials(rows);
  const spots = findDuplicateSpots(rows);
  const rowErrors: { row: number; errors: string[] }[] = [];
  const inserts: MachineInsert[] = [];
  const placements: (PlacementInsert | null)[] = [];

  rows.forEach((raw, i) => {
    const { errors, row, placement } = checkRow(raw, { allowCost, sites, today });
    if (dupes.has(i)) errors.push(dupes.get(i)!);
    if (spots.has(i)) errors.push(spots.get(i)!);
    const serial = (raw.serial_number ?? "").trim().toLowerCase();
    if (serial && known.has(serial)) {
      errors.push(`Serial number “${raw.serial_number?.trim()}” is already on ${known.get(serial)}.`);
    }
    // Row numbers match the spreadsheet: row 1 is the headings.
    if (errors.length || !row) rowErrors.push({ row: i + 2, errors });
    else {
      inserts.push(row);
      placements.push(placement);
    }
  });

  if (rowErrors.length) return { rowErrors };

  // Machines first, all in storage. Placed ones become Installed once their
  // placement is saved, so a machine is never Installed without a site.
  const finalStatus = inserts.map((m) => m.status);
  const machines = withoutFields(inserts, ["purchase_cost"]).map((m) =>
    m.status === "installed" ? { ...m, status: "in_storage" as const } : m,
  );
  const { data, error } = await supabase.from("machines").insert(machines).select("id, machine_number");
  if (error) return { error: `Could not save the machines: ${error.message}` };
  const range = `${data[0]?.machine_number} to ${data[data.length - 1]?.machine_number}`;

  // The database returns the new machines in the same order as the file.
  const costs = inserts
    .map((m, i) => ({ machine_id: data[i]?.id as string, purchase_cost: m.purchase_cost ?? null }))
    .filter((c) => c.machine_id && c.purchase_cost !== null);
  if (allowCost && costs.length) {
    const { error: costError } = await supabase.from("machine_costs").insert(costs);
    if (costError) {
      return {
        error: `The ${data.length} machines were added (${range}), but their purchase costs and sites weren't saved (${costError.message}). Don't import this file again: add the costs and place the machines from each machine's page.`,
      };
    }
  }

  const toPlace = placements
    .map((p, i) => (p ? { ...p, machine_id: data[i]?.id as string } : null))
    .filter((p): p is PlacementInsert & { machine_id: string } => Boolean(p?.machine_id));
  if (toPlace.length) {
    const { error: placeError } = await supabase.from("machine_placements").insert(toPlace);
    if (placeError) {
      return {
        error: `The ${data.length} machines were added (${range}) but couldn't be placed at their sites (${placeError.message}); they're In storage. Don't import this file again: place them from each machine's page.`,
      };
    }
    const installedIds = toPlace.filter((p) => finalStatus[data.findIndex((d) => d.id === p.machine_id)] === "installed").map((p) => p.machine_id);
    if (installedIds.length) {
      await supabase.from("machines").update({ status: "installed" }).in("id", installedIds);
    }
  }

  return {
    imported: {
      count: data.length,
      first: data[0]?.machine_number ?? "",
      last: data[data.length - 1]?.machine_number ?? "",
      placed: toPlace.length,
    },
  };
}
