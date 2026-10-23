// Commission payment shapes and helpers, safe to use in browser code and on the server.
import type { CommissionType } from "@/lib/location-types";

export type PaymentMethod = "bank_transfer" | "cheque" | "cash" | "other";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export const isPaymentMethod = (v: unknown): v is PaymentMethod => PAYMENT_METHODS.some((m) => m.value === v);

export type PaymentSummary = {
  id: string;
  client_id: string;
  client_name: string;
  paid_on: string; // YYYY-MM-DD
  method: PaymentMethod;
  reference: string | null;
  total_amount_paid: number;
  gst_amount: number;
  site_names: string[];
};

export type PaymentLine = {
  id: string;
  location_id: string;
  site_name: string;
  period_start: string;
  period_end: string;
  sales_amount: number | null;
  rate_applied: number | null;
  rate_type: CommissionType | null;
  commission_amount: number;
};

export type Payment = PaymentSummary & { notes: string | null; lines: PaymentLine[] };

// A site that can be paid commission, with its current setting.
export type CommissionSite = {
  location_id: string;
  site_name: string;
  commission_type: CommissionType;
  commission_rate: number | null;
};

// Rounds to cents.
export const cents = (n: number) => Math.round(n * 100) / 100;

// Whole months from start to end, counting both ends: Jan–Mar is 3.
export function monthsCovered(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

// The suggested commission for one site: a % of sales, or the monthly amount times the months.
export function suggestedCommission(
  rateType: CommissionType,
  rate: number | null,
  sales: number | null,
  start: string,
  end: string,
) {
  if (rate === null || rateType === "none") return null;
  if (rateType === "percentage") return sales === null ? null : cents((sales * rate) / 100);
  return cents(rate * monthsCovered(start, end));
}

export function rateText(rateType: CommissionType | null, rate: number | null, formatAud: (n: number) => string) {
  if (rate === null || !rateType || rateType === "none") return "No commission";
  return rateType === "percentage" ? `${rate}% of sales` : `${formatAud(rate)} per month`;
}
