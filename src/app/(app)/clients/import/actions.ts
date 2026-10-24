"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { formatAbn } from "@/lib/au";
import {
  MAX_IMPORT_ROWS,
  checkRow,
  findDuplicates,
  type ClientInsert,
  type RawRow,
} from "@/lib/client-import";

export type ImportResult = {
  error?: string;
  rowErrors?: { row: number; errors: string[] }[];
  imported?: number;
};

// Checks every row again (never trust the browser), then saves them all in
// one go: either every client is added or none are.
export async function importClients(rows: RawRow[]): Promise<ImportResult> {
  await requireRole(OFFICE_ROLES);

  if (!Array.isArray(rows) || rows.length === 0) return { error: "The file has no customers in it." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Please import at most ${MAX_IMPORT_ROWS} clients at a time.` };
  }

  const supabase = await createClient();

  // Clients already in the system, matched by name or ABN.
  const { data: existing, error: loadError } = await supabase.from("clients").select("company_name, abn");
  if (loadError) return { error: `Could not check existing customers: ${loadError.message}` };
  const knownNames = new Set(existing.map((c) => String(c.company_name).trim().toLowerCase()));
  const knownAbns = new Map(existing.filter((c) => c.abn).map((c) => [String(c.abn), c.company_name as string]));

  const dupes = findDuplicates(rows);
  const rowErrors: { row: number; errors: string[] }[] = [];
  const inserts: ClientInsert[] = [];

  rows.forEach((raw, i) => {
    const { errors, row } = checkRow(raw);
    errors.push(...(dupes.get(i) ?? []));
    if (row && knownNames.has(row.company_name.toLowerCase())) {
      errors.push(`“${row.company_name}” is already one of your customers.`);
    }
    if (row?.abn && knownAbns.has(row.abn)) {
      errors.push(`ABN ${formatAbn(row.abn)} already belongs to ${knownAbns.get(row.abn)}.`);
    }
    // Row numbers match the spreadsheet: row 1 is the headings.
    if (errors.length || !row) rowErrors.push({ row: i + 2, errors });
    else inserts.push(row);
  });

  if (rowErrors.length) return { rowErrors };

  // Clients first; their default commission goes in its own office-only table.
  const clients = inserts.map((c) => ({ ...c, commission_type: undefined, commission_rate: undefined }));
  const { data, error } = await supabase.from("clients").insert(clients).select("id");
  if (error) return { error: `Could not save the customers: ${error.message}` };

  // The database returns the new clients in the same order as the file.
  const { error: commissionError } = await supabase.from("client_commissions").insert(
    inserts.map((c, i) => ({ client_id: data[i]?.id as string, commission_type: c.commission_type, commission_rate: c.commission_rate })),
  );
  if (commissionError) {
    return {
      error: `The ${data.length} clients were added, but their commission settings weren't saved (${commissionError.message}). Don't import this file again: set the commission on each client's Edit page.`,
    };
  }

  return { imported: data.length };
}
