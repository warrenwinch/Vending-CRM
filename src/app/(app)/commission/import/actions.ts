"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listLocations } from "@/lib/locations";
import { cents, isPaymentMethod } from "@/lib/commission-types";
import { todayInSydney } from "@/lib/au";
import { isUuid } from "@/lib/ids";
import { MAX_COMMISSION_ROWS } from "@/lib/commission-import";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type CommissionImportRow = {
  line: number;
  customer: string;
  client_id: string;
  location_id: string;
  period_start: string;
  period_end: string;
  net_sales: number | null;
  commission: number;
};

export type CommissionImportResult = { error?: string; imported?: number; total?: number };

// One payment per row, dated the period end, with a single line for the
// chosen site. Every row is checked again here before anything is saved.
export async function importCommission(
  rows: CommissionImportRow[],
  method: string,
  reference: string,
  fileName: string,
): Promise<CommissionImportResult> {
  await requireRole(OFFICE_ROLES);
  if (!Array.isArray(rows) || rows.length === 0) return { error: "There are no payments to import." };
  if (rows.length > MAX_COMMISSION_ROWS) return { error: `Please import at most ${MAX_COMMISSION_ROWS} payments at a time.` };
  if (!isPaymentMethod(method)) return { error: "Please choose how they were paid." };

  const sites = new Map((await listLocations({})).map((s) => [s.id, s]));
  const today = todayInSydney();
  for (const r of rows) {
    const where = `Row ${r.line} (${r.customer})`;
    const site = isUuid(r.location_id) ? sites.get(r.location_id) : undefined;
    if (!isUuid(r.client_id) || !site || site.client_id !== r.client_id) {
      return { error: `${where}: the site doesn't belong to that customer. Please reload the page.` };
    }
    if (!DATE.test(r.period_start) || !DATE.test(r.period_end) || r.period_end < r.period_start) {
      return { error: `${where}: the period dates aren't right.` };
    }
    if (r.period_end > today) return { error: `${where}: the period ends in the future, so it can't have been paid yet.` };
    if (!Number.isFinite(r.commission) || r.commission <= 0) return { error: `${where}: the commission must be more than $0.` };
    if (r.net_sales !== null && !Number.isFinite(r.net_sales)) return { error: `${where}: the Net Sales can't be read.` };
  }

  // Don't record the same customer and period twice.
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("commission_payment_lines")
    .select("period_start, period_end, commission_payments!inner(client_id)")
    .in("period_end", [...new Set(rows.map((r) => r.period_end))]);
  if (existingError) return { error: `Could not check for payments already recorded: ${existingError.message}` };
  const done = new Set(
    (existing as unknown as { period_start: string; period_end: string; commission_payments: { client_id: string } }[]).map(
      (e) => `${e.commission_payments.client_id}|${e.period_start}|${e.period_end}`,
    ),
  );
  const repeat = rows.find((r) => done.has(`${r.client_id}|${r.period_start}|${r.period_end}`));
  if (repeat) return { error: `Row ${repeat.line} (${repeat.customer}) is already recorded for that period. Please reload the page.` };

  const created: string[] = [];
  const undo = async () => {
    if (created.length) await supabase.from("commission_payments").delete().in("id", created);
  };
  for (const r of rows) {
    const site = sites.get(r.location_id)!;
    const amount = cents(r.commission);
    const { data: payment, error } = await supabase
      .from("commission_payments")
      .insert({
        client_id: r.client_id,
        paid_on: r.period_end,
        method,
        reference: reference.trim().slice(0, 200) || null,
        total_amount_paid: amount,
        gst_amount: 0,
        notes: `Imported from Seed commission summary (${fileName.slice(0, 150)}).`,
      })
      .select("id")
      .single();
    if (error) {
      await undo();
      return { error: `Row ${r.line} (${r.customer}): could not record the payment: ${error.message}. Nothing was saved.` };
    }
    created.push(payment.id);
    const { error: lineError } = await supabase.from("commission_payment_lines").insert({
      payment_id: payment.id,
      location_id: r.location_id,
      period_start: r.period_start,
      period_end: r.period_end,
      sales_amount: r.net_sales === null ? null : cents(r.net_sales),
      rate_applied: site.commission_type === "none" ? null : site.commission_rate,
      rate_type: site.commission_type,
      commission_amount: amount,
    });
    if (lineError) {
      await undo();
      return { error: `Row ${r.line} (${r.customer}): could not record the payment: ${lineError.message}. Nothing was saved.` };
    }
  }

  revalidatePath("/commission");
  return { imported: rows.length, total: cents(rows.reduce((t, r) => t + r.commission, 0)) };
}
