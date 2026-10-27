// Turning a Seed or Nayax sales export into one row per machine.
// Works on the rows readXlsx gives back, in the browser and on the server.

export type SalesSource = "seed_vending" | "seed_market" | "nayax";

export const SALES_SOURCES: { value: SalesSource; label: string; howTo: string }[] = [
  {
    value: "seed_vending",
    label: "Seed – Vending",
    howTo: "Seed > Reports > Report Writer: Sales (Vending Realtime Sales) report with results for Asset, last month, Export to Excel.",
  },
  {
    value: "seed_market",
    label: "Seed – Markets",
    howTo: "Seed > Reports > Report Writer: Market Sales report with results for Asset, last month, Export to Excel.",
  },
  {
    value: "nayax",
    label: "Nayax",
    howTo: "Nayax > Reports > Sales Summary: Time Interval Last month, View Report, Sales By Machine tab, Export > Export to Excel.",
  },
];

export const sourceLabel = (s: SalesSource) => SALES_SOURCES.find((x) => x.value === s)?.label ?? s;
export const isSalesSource = (v: unknown): v is SalesSource => SALES_SOURCES.some((s) => s.value === v);

export type SaleRow = {
  external_id: string;
  external_name: string | null;
  units: number;
  amount: number;
  card_amount: number | null;
  cash_amount: number | null;
};

export const MAX_SALES_ROWS = 2000;

// Headings are compared without spaces, capitals or invisible characters.
const norm = (s: string) => s.replace(/[\s​-‍﻿]+/g, "").toLowerCase();

const REQUIRED: Record<SalesSource, string[]> = {
  seed_market: ["marketid", "assetid", "totalunitssold", "totalsales"],
  seed_vending: ["assetid", "totalunitssold", "totaldollarsales"],
  nayax: ["machinename", "operatoridentifier", "totaltransactioncount", "totaltransactionamount"],
};

const money = (s: string | undefined) => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

export type ParsedSales = {
  source: SalesSource;
  rows: SaleRow[];
  total: number;
  month: string | null; // "2026-09-01" when the file says which month (Nayax does)
  day: string | null; // "2026-10-26": the first day the file covers, when it says (Nayax does)
};

// Finds which report this is, reads every machine's line, and adds up any
// machine that appears twice. Throws a plain-English error if it can't.
export function parseSalesFile(table: string[][]): ParsedSales {
  let headerAt = -1;
  let source: SalesSource | null = null;
  for (let i = 0; i < Math.min(table.length, 10) && !source; i++) {
    const heads = table[i].map(norm);
    // Markets first: it has every Vending heading plus Market ID.
    for (const s of ["seed_market", "seed_vending", "nayax"] as SalesSource[]) {
      if (REQUIRED[s].every((h) => heads.includes(h))) {
        source = s;
        headerAt = i;
        break;
      }
    }
  }
  if (!source) {
    throw new Error(
      "This file isn't one of the sales reports the CRM knows. Use Seed's Vending or Market Sales report (by Asset), or Nayax's Sales Summary (Sales By Machine), exported to Excel.",
    );
  }

  const heads = table[headerAt].map(norm);
  const col = (h: string) => heads.indexOf(h);
  const cell = (row: string[], h: string) => (col(h) >= 0 ? (row[col(h)] ?? "").trim() : "");

  // Nayax says which dates it covers in its title: "Searched Date Range: 1/9/2026 …".
  let month: string | null = null;
  let day: string | null = null;
  const title = table.slice(0, headerAt).flat().join(" ");
  const range = /Date Range:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(title);
  if (range) {
    month = `${range[3]}-${range[2].padStart(2, "0")}-01`;
    day = `${range[3]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`;
  }

  const byId = new Map<string, SaleRow>();
  for (const [i, row] of table.slice(headerAt + 1).entries()) {
    let id: string;
    let name: string | null;
    let units: number;
    let amount: number | null;
    let card: number | null = null;
    let cash: number | null = null;

    if (source === "nayax") {
      // The machine number sometimes has a stray "-" or "." on the end ("104230-").
      const number = cell(row, "operatoridentifier").replace(/[-.\s]+$/, "");
      name = cell(row, "machinename") || null;
      id = number || name || "";
      units = Number(cell(row, "totaltransactioncount").replace(/,/g, "")) || 0;
      amount = money(cell(row, "totaltransactionamount"));
      card = money(cell(row, "creditcard"));
      cash = money(cell(row, "cash"));
    } else {
      id = cell(row, "assetid");
      name = [cell(row, "customer"), cell(row, "location"), cell(row, "place")]
        .filter((v, j, all) => v && all.indexOf(v) === j)
        .join(", ") || null;
      units = Number(cell(row, "totalunitssold").replace(/,/g, "")) || 0;
      amount = money(cell(row, source === "seed_market" ? "totalsales" : "totaldollarsales"));
    }

    // Blank lines and the totals line at the bottom aren't machines.
    if (!id || /^(grand )?totals?$/i.test(id)) continue;
    if (amount === null || Number.isNaN(amount)) {
      throw new Error(`Row ${headerAt + i + 2} (${id}) has a sales amount the CRM can't read.`);
    }
    const seen = byId.get(id);
    if (seen) {
      seen.units += units;
      seen.amount = Math.round((seen.amount + amount) * 100) / 100;
      if (card !== null) seen.card_amount = Math.round(((seen.card_amount ?? 0) + card) * 100) / 100;
      if (cash !== null) seen.cash_amount = Math.round(((seen.cash_amount ?? 0) + cash) * 100) / 100;
    } else {
      byId.set(id, { external_id: id.slice(0, 200), external_name: name?.slice(0, 300) ?? null, units, amount, card_amount: card, cash_amount: cash });
    }
  }

  const rows = [...byId.values()];
  if (rows.length === 0) throw new Error("This report has no machines with sales in it.");
  const total = Math.round(rows.reduce((t, r) => t + r.amount, 0) * 100) / 100;
  return { source, rows, total, month, day };
}

// "2026-10-27" plus a number of days (negative goes back), as a date string.
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DailyTotal ={ source: SalesSource; day: string; units: number; amount: number };

// A history file of daily totals: day, source, units, amount (one row per
// system per day). Days can be DD/MM/YYYY or YYYY-MM-DD.
export function parseDailyHistory(rows: Record<string, string>[]): DailyTotal[] {
  const out: DailyTotal[] = [];
  rows.forEach((r, i) => {
    const get = (k: string) => (r[k] ?? "").trim();
    const rawDay = get("day") || get("date");
    const au = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rawDay);
    const day = au ? `${au[3]}-${au[2].padStart(2, "0")}-${au[1].padStart(2, "0")}` : rawDay;
    const source = get("source");
    const amount = money(get("amount"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Row ${i + 2}: “${rawDay}” isn't a date.`);
    if (!isSalesSource(source)) throw new Error(`Row ${i + 2}: “${source}” should be seed_vending, seed_market or nayax.`);
    if (amount === null || Number.isNaN(amount)) throw new Error(`Row ${i + 2}: the amount can't be read.`);
    out.push({ source, day, units: Number(get("units").replace(/,/g, "")) || 0, amount });
  });
  return out;
}

// Ways a sales ID might match a CRM machine: the imported serial number,
// its position on site, or both together (the Asset IDs were split that way).
export const matchKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
