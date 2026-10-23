// Fault shapes, labels and time helpers, safe to use in browser code and on the server.

export type FaultCategory =
  | "vend_failure"
  | "coin_mechanism"
  | "note_reader"
  | "card_reader"
  | "refrigeration"
  | "display"
  | "door_lock"
  | "power"
  | "other";
export type FaultSeverity = "not_working" | "partly_working";

export const FAULT_CATEGORIES: { value: FaultCategory; label: string }[] = [
  { value: "vend_failure", label: "Product not vending / jammed" },
  { value: "coin_mechanism", label: "Coin mechanism" },
  { value: "note_reader", label: "Note reader" },
  { value: "card_reader", label: "Card reader" },
  { value: "refrigeration", label: "Cooling / refrigeration" },
  { value: "display", label: "Display or keypad" },
  { value: "door_lock", label: "Door or lock" },
  { value: "power", label: "Power" },
  { value: "other", label: "Other" },
];

export const FAULT_SEVERITIES: { value: FaultSeverity; label: string }[] = [
  { value: "partly_working", label: "Partly working" },
  { value: "not_working", label: "Not working at all" },
];

export const isFaultCategory = (v: unknown): v is FaultCategory => FAULT_CATEGORIES.some((c) => c.value === v);
export const isFaultSeverity = (v: unknown): v is FaultSeverity => FAULT_SEVERITIES.some((s) => s.value === v);
export const categoryLabel = (v: FaultCategory) => FAULT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export type Fault = {
  id: string;
  machine_id: string;
  machine_number: string;
  location_id: string | null;
  site_name: string | null;
  category: FaultCategory;
  severity: FaultSeverity;
  description: string;
  reported_by: string;
  reporter_name: string;
  reported_at: string; // ISO timestamp
  fixed_by: string | null;
  fixer_name: string | null;
  fixed_at: string | null;
  fix_notes: string | null;
};

// 135 minutes -> "2 h 15 min"; 3 days 4 hours -> "3 days 4 h".
export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} day${days === 1 ? "" : "s"} ${hours % 24} h` : `${days} day${days === 1 ? "" : "s"}`;
}

export const timeToFix = (f: Pick<Fault, "reported_at" | "fixed_at">) =>
  f.fixed_at ? new Date(f.fixed_at).getTime() - new Date(f.reported_at).getTime() : null;

// "23/10/2026 2:15 pm" in Sydney time.
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

// The current moment, for "open for" and "last 30 days" (pages are drawn fresh for each visit).
export function nowMs() {
  return Date.now();
}
