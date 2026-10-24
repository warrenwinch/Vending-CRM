"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listClientOptions } from "@/lib/locations";
import {
  MAX_IMPORT_ROWS,
  checkRow,
  clientKey,
  findDuplicates,
  type LocationInsert,
  type RawRow,
} from "@/lib/location-import";

export type ImportResult = {
  error?: string;
  rowErrors?: { row: number; errors: string[] }[];
  imported?: number;
};

// Checks every row again (never trust the browser), then saves the sites
// in one go, followed by their commission settings.
export async function importLocations(rows: RawRow[]): Promise<ImportResult> {
  await requireRole(OFFICE_ROLES);

  if (!Array.isArray(rows) || rows.length === 0) return { error: "The file has no locations in it." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Please import at most ${MAX_IMPORT_ROWS} locations at a time.` };
  }

  const supabase = await createClient();
  const clientOptions = await listClientOptions();
  const clients = new Map(clientOptions.map((c) => [clientKey(c.label), c.value]));

  // Sites already in the system, per client.
  const { data: existing, error: loadError } = await supabase.from("locations").select("client_id, site_name");
  if (loadError) return { error: `Could not check existing locations: ${loadError.message}` };
  const known = new Set(existing.map((l) => `${l.client_id}|${clientKey(String(l.site_name))}`));

  const dupes = findDuplicates(rows);
  const rowErrors: { row: number; errors: string[] }[] = [];
  const inserts: LocationInsert[] = [];

  rows.forEach((raw, i) => {
    const { errors, row } = checkRow(raw, clients);
    if (dupes.has(i)) errors.push(dupes.get(i)!);
    if (row && known.has(`${row.client_id}|${clientKey(row.site_name)}`)) {
      errors.push(`“${row.site_name}” already exists for this customer.`);
    }
    // Row numbers match the spreadsheet: row 1 is the headings.
    if (errors.length || !row) rowErrors.push({ row: i + 2, errors });
    else inserts.push(row);
  });

  if (rowErrors.length) return { rowErrors };

  // Sites first (the commission fields live in their own private table).
  const sites = inserts.map((l) => ({ ...l, follows_client: undefined, commission_type: undefined, commission_rate: undefined }));
  const { data, error } = await supabase.from("locations").insert(sites).select("id");
  if (error) return { error: `Could not save the locations: ${error.message}` };

  // The database returns the new sites in the same order as the file.
  const commissions = inserts.map((l, i) => ({
    location_id: data[i]?.id as string,
    follows_client: l.follows_client,
    commission_type: l.commission_type,
    commission_rate: l.commission_rate,
  }));
  const { error: commissionError } = await supabase.from("location_commissions").insert(commissions);
  if (commissionError) {
    return {
      error: `The ${data.length} locations were added, but their commission settings weren't saved (${commissionError.message}). Don't import this file again: set the commission on each site's Edit page.`,
    };
  }

  return { imported: data.length };
}
