// Where machines are and have been. Every move is its own row; the row
// with no end date is where the machine is now.
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Placement = {
  id: string;
  machine_id: string;
  location_id: string;
  position: string | null; // where inside the site, e.g. "Level 4N"
  started_on: string; // YYYY-MM-DD
  ended_on: string | null;
  site_name: string;
};

type Row = Omit<Placement, "site_name"> & { locations: { site_name: string } | null };

const COLUMNS = "id, machine_id, location_id, position, started_on, ended_on, locations(site_name)";

const toPlacement = ({ locations, ...row }: Row): Placement => ({
  ...row,
  site_name: locations?.site_name ?? "Unknown site",
});

// "ABS House, Level 4N" or just "ABS House".
export function placeName(p: { site_name: string; position: string | null }) {
  return p.position ? `${p.site_name}, ${p.position}` : p.site_name;
}

// Newest first, so the current placement (if any) is at the top.
export async function getPlacementHistory(machineId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_placements")
    .select(COLUMNS)
    .eq("machine_id", machineId)
    .order("started_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load this machine's history: ${error.message}`);
  return (data as unknown as Row[]).map(toPlacement);
}

export async function getOpenPlacement(machineId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_placements")
    .select(COLUMNS)
    .eq("machine_id", machineId)
    .is("ended_on", null)
    .maybeSingle();
  if (error) throw new Error(`Could not check where this machine is: ${error.message}`);
  return data ? toPlacement(data as unknown as Row) : null;
}

// Machines currently at one location.
export async function listMachinesAtLocation(locationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_placements")
    .select("started_on, position, machines(id, machine_number, type, manufacturer, model, status)")
    .eq("location_id", locationId)
    .is("ended_on", null)
    .order("started_on");
  if (error) throw new Error(`Could not load the machines at this location: ${error.message}`);
  type MachineRow = {
    id: string;
    machine_number: string;
    type: string;
    manufacturer: string | null;
    model: string | null;
    status: string;
  };
  return (data as unknown as { started_on: string; position: string | null; machines: MachineRow | null }[])
    .filter((p) => p.machines)
    .map((p) => ({ ...p.machines!, started_on: p.started_on, position: p.position }));
}
