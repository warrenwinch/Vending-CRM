// Reading imported sales (Administrators and Managers only; the database
// hides them from everyone else).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { matchKey, type SalesSource } from "@/lib/sales-import";

type MachineKeyRow = {
  id: string;
  machine_number: string;
  serial_number: string | null;
  machine_placements: { position: string | null; ended_on: string | null }[];
};

// Each way a machine could be named in Seed (its serial, its position, or
// both, which is how the Asset IDs were split when machines were imported),
// pointing at the machine, or at null when two machines share it.
export async function machineMatchKeys() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machines")
    .select("id, machine_number, serial_number, machine_placements(position, ended_on)")
    .limit(5000);
  if (error) throw new Error(`Could not load machines: ${error.message}`);
  const keys = new Map<string, string | null>();
  const add = (k: string | null | undefined, id: string) => {
    if (!k?.trim()) return;
    const key = matchKey(k);
    keys.set(key, keys.has(key) && keys.get(key) !== id ? null : id);
  };
  for (const m of data as unknown as MachineKeyRow[]) {
    const position = m.machine_placements.find((p) => p.ended_on === null)?.position ?? null;
    add(m.machine_number, m.id);
    add(m.serial_number, m.id);
    add(position, m.id);
    if (m.serial_number && position) add(`${m.serial_number} ${position}`, m.id);
  }
  return keys;
}

export type ImportedMonth = {
  month: string;
  source: SalesSource;
  machines: number;
  matched: number;
  units: number;
  total: number;
};

// What has been imported, newest month first, one line per system.
export async function listImportedMonths(): Promise<ImportedMonth[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_sales")
    .select("month, source, machine_id, units, amount")
    .order("month", { ascending: false })
    .limit(20000);
  if (error) throw new Error(`Could not load sales: ${error.message}`);
  const groups = new Map<string, ImportedMonth>();
  for (const r of data as { month: string; source: SalesSource; machine_id: string | null; units: number; amount: number | string }[]) {
    const key = `${r.month}|${r.source}`;
    const g = groups.get(key) ?? { month: r.month, source: r.source, machines: 0, matched: 0, units: 0, total: 0 };
    g.machines += 1;
    if (r.machine_id) g.matched += 1;
    g.units += r.units;
    g.total = Math.round((g.total + Number(r.amount)) * 100) / 100;
    groups.set(key, g);
  }
  return [...groups.values()];
}

export type Unmatched = {
  source: SalesSource;
  external_id: string;
  external_name: string | null;
  months: number;
  total: number;
};

// Sales IDs not yet linked to a machine (and not marked "don't track"), biggest first.
export async function listUnmatched(): Promise<Unmatched[]> {
  const supabase = await createClient();
  const [{ data: sales, error }, { data: links }] = await Promise.all([
    supabase
      .from("machine_sales")
      .select("source, external_id, external_name, amount, month")
      .is("machine_id", null)
      .order("month", { ascending: false })
      .limit(20000),
    supabase.from("sales_links").select("source, external_id"),
  ]);
  if (error) throw new Error(`Could not load sales: ${error.message}`);
  const decided = new Set((links ?? []).map((l) => `${l.source}|${l.external_id}`));
  const groups = new Map<string, Unmatched>();
  for (const r of sales as { source: SalesSource; external_id: string; external_name: string | null; amount: number | string }[]) {
    const key = `${r.source}|${r.external_id}`;
    if (decided.has(key)) continue;
    const g = groups.get(key) ?? { source: r.source, external_id: r.external_id, external_name: r.external_name, months: 0, total: 0 };
    g.months += 1;
    g.total = Math.round((g.total + Number(r.amount)) * 100) / 100;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

// IDs marked "don't track", so they can be matched after all.
export async function listIgnored() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_links")
    .select("source, external_id")
    .is("machine_id", null)
    .order("external_id");
  if (error) throw new Error(`Could not load sales links: ${error.message}`);
  return data as { source: SalesSource; external_id: string }[];
}
