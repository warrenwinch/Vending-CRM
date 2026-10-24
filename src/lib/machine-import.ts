// Checks for machine rows coming from a CSV file. Used twice: in the browser
// to preview the file, and again on the server before anything is saved.
import { parseAud } from "@/lib/au";
import { matchOption, normaliseHeader } from "@/lib/csv";
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
  // Optional: place the machine at a site as it's imported.
  "site_name",
  "position",
  "customer_name",
  "installed_on",
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

// Where a machine is placed as it's imported.
export type PlacementInsert = { location_id: string; position: string | null; started_on: string };

// A site a machine can be placed at, for matching the file's site_name.
export type SiteOption = { id: string; site_name: string; client_name: string | null };

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export { normaliseHeader };

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

export function checkRow(
  raw: RawRow,
  { allowCost, sites = [], today }: { allowCost: boolean; sites?: SiteOption[]; today: string },
) {
  const get = (name: (typeof IMPORT_COLUMNS)[number]) => (raw[name] ?? "").trim();
  const errors: string[] = [];

  const type = get("type") ? matchOption(MACHINE_TYPES, get("type")) : "snack";
  if (!type) errors.push(`Type “${get("type")}” isn't one of: ${MACHINE_TYPES.map((t) => t.label).join(", ")}.`);

  // Placing it at a site, if the file says where.
  let placement: PlacementInsert | null = null;
  const siteName = get("site_name");
  if (siteName) {
    let matches = sites.filter((s) => key(s.site_name) === key(siteName));
    if (get("customer_name")) matches = matches.filter((s) => s.client_name && key(s.client_name) === key(get("customer_name")));
    if (matches.length === 0) {
      errors.push(
        `There's no site called “${siteName}”${get("customer_name") ? ` for ${get("customer_name")}` : ""}. Add or import the site first.`,
      );
    } else if (matches.length > 1) {
      errors.push(`More than one site is called “${siteName}”. Add the customer_name to say which.`);
    } else {
      let startedOn = today;
      if (get("installed_on")) {
        const d = parseDate(get("installed_on"));
        if (!d) errors.push(`Installed on “${get("installed_on")}” should look like 23/10/2026.`);
        else if (d > today) errors.push("Installed on can't be in the future.");
        else startedOn = d;
      }
      placement = { location_id: matches[0].id, position: get("position") || null, started_on: startedOn };
    }
  } else if (get("position") || get("installed_on")) {
    errors.push("Position and installed_on need a site_name too.");
  }

  // Placed machines are Installed (or Needs repair if the file says so).
  const status = get("status") ? matchOption(MACHINE_STATUSES, get("status")) : siteName ? "installed" : "in_storage";
  if (!status) {
    errors.push(`Status “${get("status")}” isn't one of: In storage, Installed, Needs repair, Retired.`);
  } else if (status === "installed" && !siteName) {
    errors.push("Status Installed needs a site_name, so we know where it's installed.");
  } else if (siteName && (status === "in_storage" || status === "retired")) {
    errors.push(`A machine at a site can't be ${status === "retired" ? "Retired" : "In storage"}. Leave status blank, or use Needs repair.`);
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

  if (errors.length || !type || !status) return { errors, placement: null };

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
  return { errors, row, placement };
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

// Two machines in exactly the same spot at the same site is almost always a slip.
export function findDuplicateSpots(rows: RawRow[]) {
  const seen = new Map<string, number>();
  const dupes = new Map<number, string>();
  rows.forEach((r, i) => {
    if (!r.site_name?.trim() || !r.position?.trim()) return;
    const spot = `${key(r.customer_name ?? "")}|${key(r.site_name)}|${key(r.position)}`;
    if (seen.has(spot)) dupes.set(i, `“${r.site_name.trim()}, ${r.position.trim()}” is also on row ${seen.get(spot)! + 2}. Make the positions different (e.g. left / right).`);
    else seen.set(spot, i);
  });
  return dupes;
}
