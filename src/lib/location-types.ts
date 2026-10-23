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
  commission_type: CommissionType;
  commission_rate: number | null;
  // Only filled in for Administrators and Managers (the database hides clients from others).
  client_name: string | null;
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
