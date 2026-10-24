// Checks for location rows coming from a CSV file. Used twice: in the browser
// to preview the file, and again on the server before anything is saved.
// Each row names its client, which must already exist.
import { matchOption } from "@/lib/csv";
import {
  COMMISSION_TYPES,
  LOCATION_STATUSES,
  LOCATION_TYPES,
  type CommissionType,
  type LocationStatus,
  type LocationType,
} from "@/lib/location-types";

export { normaliseHeader } from "@/lib/csv";

export const MAX_IMPORT_ROWS = 500;

export const IMPORT_COLUMNS = [
  "client_name",
  "site_name",
  "address",
  "type",
  "status",
  "placement_notes",
  "access_instructions",
  "operating_hours",
  "foot_traffic",
  "commission_type",
  "commission_rate",
] as const;

export type RawRow = Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>;

export type LocationInsert = {
  client_id: string;
  site_name: string;
  address: string | null;
  type: LocationType;
  status: LocationStatus;
  placement_notes: string | null;
  access_instructions: string | null;
  operating_hours: string | null;
  foot_traffic: string | null;
  follows_client: boolean; // true = the site uses its client's commission
  commission_type: CommissionType;
  commission_rate: number | null;
};

// Client names people might type, matched without caring about capitals or spaces.
export const clientKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

// Short forms people use for commission in spreadsheets. Blank (or
// "client") means the site uses its client's commission.
const COMMISSION_ALIASES: Record<string, CommissionType | "client"> = {
  "": "client",
  client: "client",
  "same as client": "client",
  no: "none",
  "%": "percentage",
  percent: "percentage",
  fixed: "fixed_monthly",
  monthly: "fixed_monthly",
  "fixed monthly": "fixed_monthly",
};

export function checkRow(raw: RawRow, clients: Map<string, string>) {
  const get = (name: (typeof IMPORT_COLUMNS)[number]) => (raw[name] ?? "").trim();
  const errors: string[] = [];

  const clientName = get("client_name");
  const clientId = clientName ? clients.get(clientKey(clientName)) : undefined;
  if (!clientName) errors.push("Client name is missing.");
  else if (!clientId) errors.push(`There's no client called “${clientName}”. Add or import the client first.`);

  const siteName = get("site_name");
  if (!siteName) errors.push("Site name is missing.");

  const type = get("type") ? matchOption(LOCATION_TYPES, get("type")) : "other";
  if (!type) errors.push(`Type “${get("type")}” isn't one of: ${LOCATION_TYPES.map((t) => t.label).join(", ")}.`);

  const status = get("status") ? matchOption(LOCATION_STATUSES, get("status")) : "prospect";
  if (!status) errors.push(`Status “${get("status")}” isn't one of: Prospect, Active, Lost.`);

  const commissionText = get("commission_type");
  const commission =
    COMMISSION_ALIASES[commissionText.toLowerCase()] ?? matchOption(COMMISSION_TYPES, commissionText);
  if (!commission) {
    errors.push(`Commission type “${commissionText}” should be None, Percentage or Fixed monthly.`);
  }

  let rate: number | null = null;
  if (commission && commission !== "none" && commission !== "client") {
    const cleaned = get("commission_rate").replace(/[$,%\s]/g, "");
    rate = Number(cleaned);
    if (!cleaned || !Number.isFinite(rate) || rate < 0) {
      errors.push(`Commission rate “${get("commission_rate")}” should be a number, like 10 (for 10%) or 150 (for $150 a month).`);
    } else if (commission === "percentage" && rate > 100) {
      errors.push("A percentage commission can't be more than 100.");
    } else {
      rate = Math.round(rate * 100) / 100;
    }
  }

  if (errors.length || !clientId || !type || !status || !commission) return { errors };

  const row: LocationInsert = {
    client_id: clientId,
    site_name: siteName,
    address: get("address") || null,
    type,
    status,
    placement_notes: get("placement_notes") || null,
    access_instructions: get("access_instructions") || null,
    operating_hours: get("operating_hours") || null,
    foot_traffic: get("foot_traffic") || null,
    follows_client: commission === "client",
    commission_type: commission === "client" ? "none" : commission,
    commission_rate: commission === "none" || commission === "client" ? null : rate,
  };
  return { errors, row };
}

// The same site twice for the same client in one file is almost always a slip.
export function findDuplicates(rows: RawRow[]) {
  const seen = new Map<string, number>();
  const dupes = new Map<number, string>();
  rows.forEach((r, i) => {
    const key = `${clientKey(r.client_name ?? "")}|${clientKey(r.site_name ?? "")}`;
    if (!r.client_name?.trim() || !r.site_name?.trim()) return;
    if (seen.has(key)) dupes.set(i, `“${r.site_name?.trim()}” for this client is also on row ${seen.get(key)! + 2}.`);
    else seen.set(key, i);
  });
  return dupes;
}
