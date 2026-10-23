// Reading machines from the database. Every role can read them; security
// rules keep each business to its own machines.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Machine, MachineStatus } from "@/lib/machine-types";

const COLUMNS =
  "id, machine_number, manufacturer, model, serial_number, type, payment_hardware, status, purchase_date";

// Purchase cost lives in its own table that only Administrators and
// Managers can read; for everyone else it simply comes back empty.
type Cost = { purchase_cost: number | string | null };
type Row = Omit<Machine, "purchase_cost"> & { machine_costs?: Cost | Cost[] | null };

const toMachine = ({ machine_costs, ...row }: Row): Machine => {
  const c = Array.isArray(machine_costs) ? machine_costs[0] : machine_costs;
  return { ...row, purchase_cost: c?.purchase_cost == null ? null : Number(c.purchase_cost) };
};

type ListRow = Row & {
  machine_placements: { position: string | null; locations: { site_name: string } | null }[];
};

export async function listMachines({ status, search }: { status?: MachineStatus; search?: string }) {
  const supabase = await createClient();
  // Newest first: numbers go VM-999, VM-1000, so sorting the text would mix them up.
  // Only the open placement (no end date) is fetched: where each machine is now.
  let query = supabase
    .from("machines")
    .select(`${COLUMNS}, machine_placements(position, locations(site_name))`)
    .is("machine_placements.ended_on", null)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (search) {
    const term = search.replace(/[%_\\,()]/g, (c) => `\\${c}`);
    query = query.or(
      `machine_number.ilike.%${term}%,serial_number.ilike.%${term}%,manufacturer.ilike.%${term}%,model.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load machines: ${error.message}`);
  return (data as unknown as ListRow[]).map(({ machine_placements, ...row }) => {
    const here = machine_placements[0];
    const site = here?.locations?.site_name;
    return {
      ...toMachine(row),
      // "ABS House, Level 4N"
      site_name: site ? [site, here.position].filter(Boolean).join(", ") : null,
    };
  });
}

export async function getMachine(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machines")
    .select(`${COLUMNS}, machine_costs(purchase_cost)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load this machine: ${error.message}`);
  return data ? toMachine(data as unknown as Row) : null;
}
