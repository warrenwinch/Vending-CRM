// Reading imported stock variances (Administrators and Managers only; the
// database hides them from everyone else).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listMachines } from "@/lib/machines";
import { allRows, machineMatchKeys } from "@/lib/sales";
import { matchKey } from "@/lib/sales-import";

export type Variance = {
  id: string;
  ticket_date: string;
  driver_name: string;
  external_id: string;
  coil: string | null;
  item_name: string | null;
  observed: number;
  variance: number;
};

export async function listVariances(from: string, to: string) {
  const supabase = await createClient();
  return allRows<Variance>((start, end) =>
    supabase
      .from("stock_variances")
      .select("id, ticket_date, driver_name, external_id, coil, item_name, observed, variance")
      .gte("ticket_date", from)
      .lte("ticket_date", to)
      .order("id")
      .range(start, end),
  );
}

export type RunMachine = { id: string; ticket_date: string; driver_name: string; external_id: string };

export async function listRunMachines(from: string, to: string) {
  const supabase = await createClient();
  return allRows<RunMachine>((start, end) =>
    supabase
      .from("stock_run_machines")
      .select("id, ticket_date, driver_name, external_id")
      .gte("ticket_date", from)
      .lte("ticket_date", to)
      .order("id")
      .range(start, end),
  );
}

// Every driver name used so far, for the list when importing.
export async function listVarianceDrivers() {
  const supabase = await createClient();
  const [counted, filled] = await Promise.all(
    (["stock_variances", "stock_run_machines"] as const).map((table) =>
      allRows<{ id: string; driver_name: string }>((start, end) =>
        supabase.from(table).select("id, driver_name").order("id").range(start, end),
      ),
    ),
  );
  return [...new Map([...counted, ...filled].map((r) => [r.driver_name.toLowerCase(), r.driver_name])).values()];
}

export type AssetMachine = { id: string; machine_number: string; site_name: string | null };

// Which CRM machine each Seed Asset ID is: a link already chosen on the Sales
// page first, otherwise a machine with that serial, position or number.
export async function assetMachines() {
  const supabase = await createClient();
  const [{ data, error }, keys, machines] = await Promise.all([
    supabase.from("sales_links").select("external_id, machine_id").in("source", ["seed_vending", "seed_market"]).not("machine_id", "is", null),
    machineMatchKeys(),
    listMachines({}),
  ]);
  if (error) throw new Error(`Could not load sales links: ${error.message}`);
  const byId = new Map(machines.map((m) => [m.id, m]));
  const links = new Map((data as { external_id: string; machine_id: string }[]).map((l) => [l.external_id, l.machine_id]));
  return (externalId: string): AssetMachine | null => {
    const machine = byId.get(links.get(externalId) ?? keys.get(matchKey(externalId)) ?? "");
    return machine ? { id: machine.id, machine_number: machine.machine_number, site_name: machine.site_name ?? null } : null;
  };
}
