// Checks for client rows coming from a CSV file. Used twice: in the browser
// to preview the file, and again on the server before anything is saved.
import { digitsOnly, isValidAbn } from "@/lib/au";
import { matchOption } from "@/lib/csv";
import { CLIENT_STATUSES, type ClientStatus } from "@/lib/client-types";
import { COMMISSION_TYPES, parseCommissionRate, type CommissionType } from "@/lib/location-types";

export { normaliseHeader } from "@/lib/csv";

export const MAX_IMPORT_ROWS = 500;

export const IMPORT_COLUMNS = [
  "company_name",
  "abn",
  "gst_registered",
  "billing_contact",
  "billing_email",
  "billing_phone",
  "status",
  "commission_type",
  "commission_rate",
] as const;

export type RawRow = Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>;

export type ClientInsert = {
  company_name: string;
  abn: string | null;
  gst_registered: boolean;
  billing_contact: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  status: ClientStatus;
  commission_type: CommissionType; // default for the client's sites
  commission_rate: number | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const YES = ["yes", "y", "true", "1"];
const NO = ["no", "n", "false", "0", ""];

export function checkRow(raw: RawRow) {
  const get = (name: (typeof IMPORT_COLUMNS)[number]) => (raw[name] ?? "").trim();
  const errors: string[] = [];

  const companyName = get("company_name");
  if (!companyName) errors.push("Company name is missing.");

  // People can type spaces; we store 11 digits.
  const abn = digitsOnly(get("abn"));
  if (get("abn") && abn.length !== 11) errors.push(`ABN “${get("abn")}” should have 11 digits.`);
  else if (abn && !isValidAbn(abn)) errors.push(`ABN “${get("abn")}” doesn't look right. Please check the digits.`);

  const gstText = get("gst_registered").toLowerCase();
  const gst = YES.includes(gstText) ? true : NO.includes(gstText) ? false : null;
  if (gst === null) errors.push(`GST registered “${get("gst_registered")}” should be Yes or No.`);

  const email = get("billing_email").toLowerCase();
  if (email && !EMAIL.test(email)) errors.push(`Billing email “${get("billing_email")}” doesn't look like an email address.`);

  const status = get("status") ? matchOption(CLIENT_STATUSES, get("status")) : "prospect";
  if (!status) errors.push(`Status “${get("status")}” isn't one of: Prospect, Active, Lost.`);

  const commissionText = get("commission_type").toLowerCase();
  const commission: CommissionType | undefined =
    !commissionText || commissionText === "no"
      ? "none"
      : commissionText === "%" || commissionText === "percent"
        ? "percentage"
        : commissionText === "fixed" || commissionText === "monthly" || commissionText === "fixed monthly"
          ? "fixed_monthly"
          : matchOption(COMMISSION_TYPES, get("commission_type"));
  let rate: number | null = null;
  if (!commission) {
    errors.push(`Commission type “${get("commission_type")}” should be None, Percentage or Fixed monthly.`);
  } else {
    const parsed = parseCommissionRate(commission, get("commission_rate"));
    if ("error" in parsed) errors.push(`Commission rate “${get("commission_rate")}”: ${parsed.error}`);
    else rate = parsed.rate;
  }

  if (errors.length || !status || gst === null || !commission) return { errors };

  const row: ClientInsert = {
    company_name: companyName,
    abn: abn || null,
    gst_registered: gst,
    billing_contact: get("billing_contact") || null,
    billing_email: email || null,
    billing_phone: get("billing_phone") || null,
    status,
    commission_type: commission,
    commission_rate: rate,
  };
  return { errors, row };
}

// The same company name or ABN twice in one file is almost always a slip.
export function findDuplicates(rows: RawRow[]) {
  const names = new Map<string, number>();
  const abns = new Map<string, number>();
  const dupes = new Map<number, string[]>();
  const add = (i: number, message: string) => dupes.set(i, [...(dupes.get(i) ?? []), message]);

  rows.forEach((r, i) => {
    const name = (r.company_name ?? "").trim().toLowerCase();
    if (name) {
      if (names.has(name)) add(i, `“${r.company_name?.trim()}” is also on row ${names.get(name)! + 2}.`);
      else names.set(name, i);
    }
    const abn = digitsOnly(r.abn ?? "");
    if (abn.length === 11) {
      if (abns.has(abn)) add(i, `ABN ${r.abn?.trim()} is also on row ${abns.get(abn)! + 2}.`);
      else abns.set(abn, i);
    }
  });
  return dupes;
}
