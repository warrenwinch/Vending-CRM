// Reading commission payments from the database. Security rules limit
// them to Administrators and Managers in the same business.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listLocations } from "@/lib/locations";
import type { CommissionSite, Payment, PaymentLine, PaymentSummary } from "@/lib/commission-types";

const num = (v: number | string | null) => (v === null ? null : Number(v));

type LineRow = Omit<PaymentLine, "site_name" | "sales_amount" | "rate_applied" | "commission_amount"> & {
  sales_amount: number | string | null;
  rate_applied: number | string | null;
  commission_amount: number | string;
  locations: { site_name: string } | null;
};

type PaymentRow = {
  id: string;
  client_id: string;
  paid_on: string;
  method: PaymentSummary["method"];
  reference: string | null;
  total_amount_paid: number | string;
  gst_amount: number | string;
  notes: string | null;
  clients: { company_name: string } | null;
  commission_payment_lines: LineRow[];
};

const COLUMNS =
  "id, client_id, paid_on, method, reference, total_amount_paid, gst_amount, notes, clients(company_name), " +
  "commission_payment_lines(id, location_id, period_start, period_end, sales_amount, rate_applied, rate_type, commission_amount, locations(site_name))";

function toPayment(row: PaymentRow): Payment {
  const lines: PaymentLine[] = row.commission_payment_lines
    .map(({ locations, ...l }) => ({
      ...l,
      sales_amount: num(l.sales_amount),
      rate_applied: num(l.rate_applied),
      commission_amount: Number(l.commission_amount),
      site_name: l.location_id ? (locations?.site_name ?? "Unknown site") : "Whole customer",
    }))
    .sort((a, b) => a.site_name.localeCompare(b.site_name));
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.clients?.company_name ?? "Unknown client",
    paid_on: row.paid_on,
    method: row.method,
    reference: row.reference,
    total_amount_paid: Number(row.total_amount_paid),
    gst_amount: Number(row.gst_amount),
    notes: row.notes,
    site_names: lines.map((l) => l.site_name),
    lines,
  };
}

// Newest payments first.
export async function listPayments({ clientId }: { clientId?: string } = {}): Promise<Payment[]> {
  const supabase = await createClient();
  let query = supabase
    .from("commission_payments")
    .select(COLUMNS)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load commission payments: ${error.message}`);
  return (data as unknown as PaymentRow[]).map(toPayment);
}

export async function getPayment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("commission_payments").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this payment: ${error.message}`);
  return data ? toPayment(data as unknown as PaymentRow) : null;
}

// A client's sites (not lost) with their current commission setting.
export async function listCommissionSites(clientId: string): Promise<CommissionSite[]> {
  const sites = await listLocations({ clientId });
  return sites
    .filter((s) => s.status !== "lost" || s.commission_type !== "none")
    .map((s) => ({
      location_id: s.id,
      site_name: s.site_name,
      commission_type: s.commission_type,
      commission_rate: s.commission_rate,
    }));
}
