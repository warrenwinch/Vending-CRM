// Reading Seed's "Commission summary" CSV: one row per customer with the
// commission owed for a period. Works in the browser and on the server.

export type CommissionRow = {
  line: number; // the row number in the file, for messages
  customer: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;
  commission: number; // rounded to cents
  net_sales: number | null;
};

export const MAX_COMMISSION_ROWS = 300;

const norm = (s: string) => s.replace(/^﻿/, "").trim().toLowerCase();

// Customer names compared without capitals or extra spaces.
export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// "1/07/2026" -> "2026-07-01".
function auDate(s: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

// "$1,720.680" -> 1720.68. Blank is null; anything unreadable is NaN.
function money(s: string | undefined) {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// Finds the heading row, then reads every customer. Throws a plain-English
// error if the file isn't the commission summary.
export function parseCommissionFile(table: string[][]): { rows: CommissionRow[]; errors: string[] } {
  const headerAt = table.findIndex((r) => {
    const h = r.map(norm);
    return h.includes("customer name") && h.includes("commissions") && h.includes("period end date");
  });
  if (headerAt < 0) {
    throw new Error(
      "This isn't Seed's commission summary. It needs the columns Period Start Date, Period End Date, Customer Name and Commissions.",
    );
  }
  const heads = table[headerAt].map(norm);
  const cell = (row: string[], h: string) => (heads.indexOf(h) >= 0 ? (row[heads.indexOf(h)] ?? "").trim() : "");

  const rows: CommissionRow[] = [];
  const errors: string[] = [];
  table.slice(headerAt + 1).forEach((row, i) => {
    const line = headerAt + i + 2;
    const customer = cell(row, "customer name");
    if (!customer || /^(grand )?totals?$/i.test(customer)) return;
    const start = auDate(cell(row, "period start date"));
    const end = auDate(cell(row, "period end date"));
    const commission = money(cell(row, "commissions"));
    const net = money(cell(row, "net sales"));
    if (!start || !end) return void errors.push(`Row ${line} (${customer}): the period dates should be like 1/07/2026.`);
    if (end < start) return void errors.push(`Row ${line} (${customer}): the period ends before it starts.`);
    if (commission === null || Number.isNaN(commission)) {
      return void errors.push(`Row ${line} (${customer}): the Commissions amount can't be read.`);
    }
    if (Number.isNaN(net)) return void errors.push(`Row ${line} (${customer}): the Net Sales amount can't be read.`);
    rows.push({ line, customer, period_start: start, period_end: end, commission, net_sales: net });
  });
  return { rows, errors };
}
