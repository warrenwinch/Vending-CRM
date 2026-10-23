// Checks for machine rows coming from a CSV file. Used twice: in the browser
// to preview the file, and again on the server before anything is saved.
import { parseAud } from "@/lib/au";
import { MACHINE_STATUSES, MACHINE_TYPES, type MachineStatus, type MachineType } from "@/lib/machine-types";

export const MAX_IMPORT_ROWS = 500;

export const IMPORT_COLUMNS = [
  "type",
  "status",
  "manufacturer",
  "model",
  "serial_number",
  "payment_hardware",
  "purchase_date",
  "purchase_cost",
] as const;

export type RawRow = Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>;

export type MachineInsert = {
  type: MachineType;
  status: MachineStatus;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  payment_hardware: string | null;
  purchase_date: string | null; // YYYY-MM-DD
  purchase_cost?: number | null;
};

// "Purchase Date" -> "purchase_date"
export function normaliseHeader(header: string) {
  return header.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const squash = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

// Accepts the stored value or the label people see: "micro_market", "Micro market".
function matchOption<T extends string>(list: { value: T; label: string }[], text: string) {
  const key = squash(text);
  return list.find((o) => squash(o.value) === key || squash(o.label) === key)?.value;
}

// "23/10/2026", "3/1/2026" or "2026-10-23" -> "2026-10-23"; null if not a real date.
function parseDate(text: string) {
  let d: number, m: number, y: number;
  const au = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (au) [d, m, y] = [Number(au[1]), Number(au[2]), Number(au[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function checkRow(raw: RawRow, { allowCost }: { allowCost: boolean }) {
  const get = (name: (typeof IMPORT_COLUMNS)[number]) => (raw[name] ?? "").trim();
  const errors: string[] = [];

  const type = get("type") ? matchOption(MACHINE_TYPES, get("type")) : "snack";
  if (!type) errors.push(`Type “${get("type")}” isn't one of: ${MACHINE_TYPES.map((t) => t.label).join(", ")}.`);

  const status = get("status") ? matchOption(MACHINE_STATUSES, get("status")) : "in_storage";
  if (!status) {
    errors.push(`Status “${get("status")}” isn't one of: In storage, Needs repair, Retired.`);
  } else if (status === "installed") {
    errors.push("Status can't be Installed. Import it as In storage, then place it at a location.");
  }

  let purchaseDate: string | null = null;
  if (get("purchase_date")) {
    purchaseDate = parseDate(get("purchase_date"));
    if (!purchaseDate) errors.push(`Purchase date “${get("purchase_date")}” should look like 23/10/2026.`);
  }

  let cost: number | null = null;
  if (allowCost && get("purchase_cost")) {
    cost = parseAud(get("purchase_cost"));
    if (cost === null) errors.push(`Purchase cost “${get("purchase_cost")}” should be dollars, like 4500 or 4,500.00.`);
  }

  if (errors.length || !type || !status) return { errors };

  const row: MachineInsert = {
    type,
    status,
    manufacturer: get("manufacturer") || null,
    model: get("model") || null,
    serial_number: get("serial_number") || null,
    payment_hardware: get("payment_hardware") || null,
    purchase_date: purchaseDate,
  };
  // Only Administrators and Managers may set what a machine cost.
  if (allowCost) row.purchase_cost = cost;
  return { errors, row };
}

// The same serial number twice in one file is almost always a copy-paste slip.
export function findDuplicateSerials(rows: RawRow[]) {
  const seen = new Map<string, number>();
  const dupes = new Map<number, string>();
  rows.forEach((r, i) => {
    const serial = (r.serial_number ?? "").trim().toLowerCase();
    if (!serial) return;
    if (seen.has(serial)) dupes.set(i, `Serial number “${r.serial_number?.trim()}” is also on row ${seen.get(serial)! + 2}.`);
    else seen.set(serial, i);
  });
  return dupes;
}
