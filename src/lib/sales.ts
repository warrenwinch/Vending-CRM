// Reading imported sales (Administrators and Managers only; the database
// hides them from everyone else).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { matchKey, type SalesSource } from "@/lib/sales-import";

// Supabase hands back at most 1,000 rows per request: keep asking until
// every row is in. `page` must sort by something unique (e.g. id).
async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(`Could not load sales: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

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
  const data = await allRows<{ month: string; source: SalesSource; machine_id: string | null; units: number; amount: number | string }>(
    (from, to) =>
      supabase
        .from("machine_sales")
        .select("month, source, machine_id, units, amount")
        .order("month", { ascending: false })
        .order("id")
        .range(from, to),
  );
  const groups = new Map<string, ImportedMonth>();
  for (const r of data) {
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
  type Row = { source: SalesSource; external_id: string; external_name: string | null; amount: number | string };
  const [sales, links] = await Promise.all([
    allRows<Row>((from, to) =>
      supabase
        .from("machine_sales")
        .select("source, external_id, external_name, amount, month")
        .is("machine_id", null)
        .order("month", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    allRows<{ source: SalesSource; external_id: string }>((from, to) =>
      supabase.from("sales_links").select("source, external_id").order("source").order("external_id").range(from, to),
    ),
  ]);
  const decided = new Set(links.map((l) => `${l.source}|${l.external_id}`));
  const groups = new Map<string, Unmatched>();
  for (const r of sales) {
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

export type MonthTotal = { month: string; total: number; bySource: Partial<Record<SalesSource, number>> };

// Each imported month's total, oldest first (for the trend), up to `months` back.
export async function monthlyTotals(months = 12): Promise<MonthTotal[]> {
  const supabase = await createClient();
  const data = await allRows<{ month: string; source: SalesSource; amount: number | string }>((from, to) =>
    supabase.from("machine_sales").select("month, source, amount").order("id").range(from, to),
  );
  const byMonth = new Map<string, MonthTotal>();
  for (const r of data) {
    const m = byMonth.get(r.month) ?? { month: r.month, total: 0, bySource: {} };
    const amount = Number(r.amount);
    m.total = Math.round((m.total + amount) * 100) / 100;
    m.bySource[r.source] = Math.round(((m.bySource[r.source] ?? 0) + amount) * 100) / 100;
    byMonth.set(r.month, m);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-months);
}

export type MachineMonthSale = {
  machine_id: string | null;
  label: string; // "VM-012 · ABS House, Level 5N", or the sales ID when unmatched
  customer: string;
  amount: number;
  units: number;
};

const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

// One month's sales per machine (all systems added together), with the
// customer whose site the machine was at during that month.
export async function salesForMonth(month: string): Promise<MachineMonthSale[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_sales")
    .select("machine_id, external_id, external_name, amount, units, machines(machine_number)")
    .eq("month", month)
    .limit(5000);
  if (error) throw new Error(`Could not load sales: ${error.message}`);
  type Row = {
    machine_id: string | null;
    external_id: string;
    external_name: string | null;
    amount: number | string;
    units: number;
    machines: { machine_number: string } | null;
  };
  const rows = data as unknown as Row[];

  // Where each machine was that month: the latest placement overlapping it.
  // Machines imported without an "installed on" date only have placements
  // from the import day, so for earlier months use the first site on record.
  const ids = [...new Set(rows.map((r) => r.machine_id).filter((id): id is string => Boolean(id)))];
  const where = new Map<string, { site: string; customer: string }>();
  if (ids.length) {
    const { data: places } = await supabase
      .from("machine_placements")
      .select("machine_id, position, started_on, ended_on, locations(site_name, clients(company_name))")
      .in("machine_id", ids)
      .order("started_on");
    type Place = {
      machine_id: string;
      position: string | null;
      started_on: string;
      ended_on: string | null;
      locations: { site_name: string; clients: { company_name: string } | null } | null;
    };
    const end = monthEnd(month);
    const byMachine = new Map<string, Place[]>();
    for (const p of (places ?? []) as unknown as Place[]) {
      byMachine.set(p.machine_id, [...(byMachine.get(p.machine_id) ?? []), p]);
    }
    for (const [id, list] of byMachine) {
      const during = list.filter((p) => p.started_on <= end && (p.ended_on === null || p.ended_on >= month)).at(-1);
      const p = during ?? list.find((x) => x.started_on > end);
      if (!p) continue;
      where.set(id, {
        site: [p.locations?.site_name, p.position].filter(Boolean).join(", "),
        customer: p.locations?.clients?.company_name ?? "Unknown customer",
      });
    }
  }

  // A machine can appear in more than one system (e.g. Seed and Nayax): add them up.
  const out = new Map<string, MachineMonthSale>();
  for (const r of rows) {
    const key = r.machine_id ?? `x:${r.external_id}`;
    const place = r.machine_id ? where.get(r.machine_id) : undefined;
    const e = out.get(key) ?? {
      machine_id: r.machine_id,
      label: r.machine_id
        ? [r.machines?.machine_number, place?.site || "Not at a site"].filter(Boolean).join(" · ")
        : r.external_name
          ? `${r.external_id} · ${r.external_name}`
          : r.external_id,
      customer: r.machine_id ? (place?.customer ?? "Not at a site") : "Not matched to a machine",
      amount: 0,
      units: 0,
    };
    e.amount = Math.round((e.amount + Number(r.amount)) * 100) / 100;
    e.units += r.units;
    out.set(key, e);
  }
  return [...out.values()].sort((a, b) => b.amount - a.amount);
}

// One machine's sales per month, newest first.
export async function machineSalesHistory(machineId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_sales")
    .select("month, source, amount, units")
    .eq("machine_id", machineId)
    .order("month", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not load this machine's sales: ${error.message}`);
  const byMonth = new Map<string, { month: string; amount: number; units: number }>();
  for (const r of data as { month: string; amount: number | string; units: number }[]) {
    const m = byMonth.get(r.month) ?? { month: r.month, amount: 0, units: 0 };
    m.amount = Math.round((m.amount + Number(r.amount)) * 100) / 100;
    m.units += r.units;
    byMonth.set(r.month, m);
  }
  return [...byMonth.values()];
}
