// Reading machine faults. Everyone in the business can see them.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Fault } from "@/lib/fault-types";

// Two links to people (who reported, who fixed), so each is named.
const COLUMNS =
  "id, machine_id, location_id, category, severity, description, reported_by, reported_by_public, reporter_contact, reported_at, fixed_by, fixed_at, fix_notes, " +
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
  // Customers who scanned a QR sticker have no account, just optional contact details.
  reporter_name: row.reported_by_public ? "Member of the public" : (reporter?.full_name ?? "Former team member"),
  fixer_name: row.fixed_by ? (fixer?.full_name ?? "Former team member") : null,
});

// Sydney calendar date of a moment, as placements store dates ("2026-10-23").
const sydneyDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date(iso));

// Adds where inside the site each machine was when its fault was found,
// e.g. "ABS House" becomes "ABS House, Level 4N".
async function withPositions(faults: Fault[]) {
  const machineIds = [...new Set(faults.filter((f) => f.location_id).map((f) => f.machine_id))];
  if (!machineIds.length) return faults;
  const supabase = await createClient();
  const { data } = await supabase
    .from("machine_placements")
    .select("machine_id, location_id, position, started_on, ended_on")
    .in("machine_id", machineIds)
    .not("position", "is", null);
  const placements = (data ?? []) as {
    machine_id: string;
    location_id: string;
    position: string;
    started_on: string;
    ended_on: string | null;
  }[];
  return faults.map((f) => {
    const day = sydneyDate(f.reported_at);
    const there = placements.find(
      (p) =>
        p.machine_id === f.machine_id &&
        p.location_id === f.location_id &&
        p.started_on <= day &&
        (p.ended_on === null || p.ended_on >= day),
    );
    return there && f.site_name ? { ...f, site_name: `${f.site_name}, ${there.position}` } : f;
  });
}

export async function listFaults({
  machineId,
  locationId,
  open,
}: { machineId?: string; locationId?: string; open?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase.from("machine_faults").select(COLUMNS).order("reported_at", { ascending: false });
  if (machineId) query = query.eq("machine_id", machineId);
  if (locationId) query = query.eq("location_id", locationId);
  if (open === true) query = query.is("fixed_at", null);
  if (open === false) query = query.not("fixed_at", "is", null);
  const { data, error } = await query.limit(500);
  if (error) throw new Error(`Could not load faults: ${error.message}`);
  return withPositions((data as unknown as Row[]).map(toFault));
}

export async function getFault(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("machine_faults").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this fault: ${error.message}`);
  return data ? (await withPositions([toFault(data as unknown as Row)]))[0] : null;
}

// How many faults are open, per site and per machine, for the badges on lists.
export async function openFaultCounts() {
  const supabase = await createClient();
  const { data } = await supabase.from("machine_faults").select("machine_id, location_id").is("fixed_at", null);
  const bySite = new Map<string, number>();
  const byMachine = new Map<string, number>();
  for (const f of (data ?? []) as { machine_id: string; location_id: string | null }[]) {
    byMachine.set(f.machine_id, (byMachine.get(f.machine_id) ?? 0) + 1);
    if (f.location_id) bySite.set(f.location_id, (bySite.get(f.location_id) ?? 0) + 1);
  }
  return { bySite, byMachine };
}
