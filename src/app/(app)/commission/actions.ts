"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listCommissionSites } from "@/lib/commission";
import { cents, isPaymentMethod } from "@/lib/commission-types";
import { formatDate, parseAud, todayInSydney } from "@/lib/au";
import { isUuid } from "@/lib/ids";
import type { FormState } from "@/components/form-ui";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type LineInput = { location_id: string; period_start: string; period_end: string; sales: string; amount: string };

// Records one payment to a client, with one line per site it covers.
// Every figure is checked again here; the browser's sums are only a preview.
export async function recordPayment(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OFFICE_ROLES);

  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    paid_on: get("paid_on"),
    method: get("method"),
    reference: get("reference"),
    notes: get("notes"),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(clientId)) return fail("This customer wasn't found.");
  if (!DATE.test(values.paid_on)) return fail("Please choose the date paid.");
  if (values.paid_on > todayInSydney()) return fail("The date paid can't be in the future.");
  if (!isPaymentMethod(values.method)) return fail("Please choose how it was paid.");

  let input: LineInput[];
  try {
    input = JSON.parse(get("lines"));
    if (!Array.isArray(input)) throw new Error();
  } catch {
    return fail("Something went wrong reading the sites. Please reload the page and try again.");
  }
  if (input.length === 0) return fail("Tick at least one site this payment covers.");

  // Sites must belong to this client; their commission setting is recorded with the line.
  const sites = new Map((await listCommissionSites(clientId)).map((s) => [s.location_id, s]));

  const lines = [];
  for (const l of input) {
    const site = sites.get(l.location_id);
    if (!site) return fail("One of the sites doesn't belong to this customer. Please reload the page.");
    const name = site.site_name;
    if (!DATE.test(l.period_start) || !DATE.test(l.period_end)) return fail(`${name}: please choose the From and To dates.`);
    if (l.period_end < l.period_start) {
      return fail(`${name}: the To date (${formatDate(l.period_end)}) is before the From date.`);
    }
    const sales = l.sales.trim() ? parseAud(l.sales) : null;
    if (l.sales.trim() && sales === null) return fail(`${name}: sales should be dollars, like 2450 or 2,450.00.`);
    const amount = parseAud(l.amount);
    if (amount === null) return fail(`${name}: please enter the commission in dollars, like 245.00.`);

    lines.push({
      location_id: l.location_id,
      period_start: l.period_start,
      period_end: l.period_end,
      sales_amount: sales,
      rate_applied: site.commission_type === "none" ? null : site.commission_rate,
      rate_type: site.commission_type,
      commission_amount: amount,
    });
  }

  const gstText = get("gst");
  const gst = gstText ? parseAud(gstText) : 0;
  if (gst === null) return fail("GST should be dollars, like 24.50 (or 0).");

  const total = cents(lines.reduce((sum, l) => sum + l.commission_amount, 0) + gst);
  if (total <= 0) return fail("The total paid is $0. Check the commission amounts.");

  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from("commission_payments")
    .insert({
      client_id: clientId,
      paid_on: values.paid_on,
      method: values.method,
      reference: values.reference || null,
      total_amount_paid: total,
      gst_amount: gst,
      notes: values.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(`Could not record the payment: ${error.message}`);

  const { error: linesError } = await supabase
    .from("commission_payment_lines")
    .insert(lines.map((l) => ({ ...l, payment_id: payment.id })));
  if (linesError) {
    // Don't leave a payment without its lines.
    await supabase.from("commission_payments").delete().eq("id", payment.id);
    return fail(`Could not record the payment: ${linesError.message}`);
  }

  redirect(`/commission/${payment.id}`);
}

// For mistakes: removes a payment and its lines.
export async function deletePayment(paymentId: string) {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(paymentId)) return;
  const supabase = await createClient();
  await supabase.from("commission_payments").delete().eq("id", paymentId);
  redirect("/commission");
}
