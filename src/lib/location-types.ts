// Location shapes and labels, safe to use in browser code and on the server.

export type LocationStatus = "prospect" | "active" | "lost";
export type LocationType =
  | "office"
  | "school"
  | "healthcare"
  | "gym"
  | "retail"
  | "industrial"
  | "government"
  | "construction"
  | "club"
  | "pub"
  | "aged_care"
  | "other";
export type CommissionType = "none" | "percentage" | "fixed_monthly";

export type Location = {
  id: string;
  client_id: string;
  site_name: string;
  address: string | null;
  placement_notes: string | null;
  type: LocationType;
  foot_traffic: string | null;
  operating_hours: string | null;
  access_instructions: string | null;
  status: LocationStatus;
  // The commission that applies: the site's own deal, or its client's default.
  commission_type: CommissionType;
  commission_rate: number | null;
  commission_follows_client: boolean; // true = uses the client's default
  site_commission_type: CommissionType; // the site's own deal, when it has one
  site_commission_rate: number | null;
  // Only filled in for Administrators and Managers (the database hides clients from others).
  client_name: string | null;
  // The team member who does this site's maintenance, if any.
  assigned_to: string | null;
  assigned_name: string | null;
};

export const LOCATION_STATUSES: { value: LocationStatus; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "lost", label: "Lost" },
];

export const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "school", label: "School" },
  { value: "healthcare", label: "Healthcare" },
  { value: "gym", label: "Gym" },
  { value: "retail", label: "Retail" },
  { value: "industrial", label: "Industrial" },
  { value: "government", label: "Government" },
  { value: "construction", label: "Construction" },
  { value: "club", label: "Club" },
  { value: "pub", label: "Pub" },
  { value: "aged_care", label: "Aged care" },
  { value: "other", label: "Other" },
];

export const COMMISSION_TYPES: { value: CommissionType; label: string }[] = [
  { value: "none", label: "No commission" },
  { value: "percentage", label: "Percentage of sales" },
  { value: "fixed_monthly", label: "Fixed amount per month" },
];

const has = <T extends string>(list: { value: T }[], value: unknown): value is T =>
  list.some((item) => item.value === value);

export const isLocationStatus = (v: unknown): v is LocationStatus => has(LOCATION_STATUSES, v);
export const isLocationType = (v: unknown): v is LocationType => has(LOCATION_TYPES, v);
export const isCommissionType = (v: unknown): v is CommissionType => has(COMMISSION_TYPES, v);

export const labelOf = <T extends string>(list: { value: T; label: string }[], value: T) =>
  list.find((item) => item.value === value)?.label ?? value;

// Reads a commission rate typed into a form: "10", "10%", "$150". Returns the
// rate (null for no commission) or a message saying what's wrong.
export function parseCommissionRate(type: CommissionType, text: string): { rate: number | null } | { error: string } {
  if (type === "none") return { rate: null };
  const cleaned = text.replace(/[$,%\s]/g, "");
  const rate = Number(cleaned);
  if (!cleaned || !Number.isFinite(rate) || rate < 0) {
    return { error: "Please enter the commission as a number, for example 10 or 150." };
  }
  if (type === "percentage" && rate > 100) return { error: "A percentage commission can't be more than 100." };
  return { rate: Math.round(rate * 100) / 100 };
}

// "10% of sales", "$150.00 per month", "No commission".
export function describeCommission(type: CommissionType, rate: number | null, formatAud: (n: number) => string) {
  if (type === "none" || rate === null) return "No commission";
  return type === "percentage" ? `${rate}% of sales` : `${formatAud(rate)} per month`;
}
