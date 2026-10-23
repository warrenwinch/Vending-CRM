// Reading machines from the database. Every role can read them; security
// rules keep each business to its own machines.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Machine, MachineStatus } from "@/lib/machine-types";

const COLUMNS =
  "id, machine_number, manufacturer, model, serial_number, type, payment_hardware, status, purchase_date, purchase_cost";

type Row = Omit<Machine, "purchase_cost"> & { purchase_cost: number | string | null };

const toMachine = (row: Row): Machine => ({
  ...row,
  purchase_cost: row.purchase_cost === null ? null : Number(row.purchase_cost),
});

export async function listMachines({ status, search }: { status?: MachineStatus; search?: string }) {
  const supabase = await createClient();
  // Newest first: numbers go VM-999, VM-1000, so sorting the text would mix them up.
  let query = supabase.from("machines").select(COLUMNS).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (search) {
    const term = search.replace(/[%_\\,()]/g, (c) => `\\${c}`);
    query = query.or(
      `machine_number.ilike.%${term}%,serial_number.ilike.%${term}%,manufacturer.ilike.%${term}%,model.ilike.%${term}%`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load machines: ${error.message}`);
  return (data as Row[]).map(toMachine);
}

export async function getMachine(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("machines").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this machine: ${error.message}`);
  return data ? toMachine(data as Row) : null;
}
