// Reading machine faults. Everyone in the business can see them.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Fault } from "@/lib/fault-types";

// Two links to people (who reported, who fixed), so each is named.
const COLUMNS =
  "id, machine_id, location_id, category, severity, description, reported_by, reported_at, fixed_by, fixed_at, fix_notes, " +
  "machines(machine_number), locations(site_name), " +
  "reporter:profiles!machine_faults_reported_by_fkey(full_name), fixer:profiles!machine_faults_fixed_by_fkey(full_name)";

type Row = Omit<Fault, "machine_number" | "site_name" | "reporter_name" | "fixer_name"> & {
  machines: { machine_number: string } | null;
  locations: { site_name: string } | null;
  reporter: { full_name: string } | null;
  fixer: { full_name: string } | null;
};

const toFault = ({ machines, locations, reporter, fixer, ...row }: Row): Fault => ({
  ...row,
  machine_number: machines?.machine_number ?? "Unknown machine",
  site_name: locations?.site_name ?? null,
  reporter_name: reporter?.full_name ?? "Former team member",
  fixer_name: row.fixed_by ? (fixer?.full_name ?? "Former team member") : null,
});

export async function listFaults({ machineId, open }: { machineId?: string; open?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase.from("machine_faults").select(COLUMNS).order("reported_at", { ascending: false });
  if (machineId) query = query.eq("machine_id", machineId);
  if (open === true) query = query.is("fixed_at", null);
  if (open === false) query = query.not("fixed_at", "is", null);
  const { data, error } = await query.limit(500);
  if (error) throw new Error(`Could not load faults: ${error.message}`);
  return (data as unknown as Row[]).map(toFault);
}

export async function getFault(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("machine_faults").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this fault: ${error.message}`);
  return data ? toFault(data as unknown as Row) : null;
}
