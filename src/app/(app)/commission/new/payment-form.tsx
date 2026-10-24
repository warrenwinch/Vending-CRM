"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { recordPayment } from "../actions";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField, type FormState } from "@/components/form-ui";
import {
  PAYMENT_METHODS,
  cents,
  rateText,
  suggestedCommission,
  type CommissionSite,
} from "@/lib/commission-types";
import { formatAud, parseAud } from "@/lib/au";

type Line = {
  location_id: string;
  include: boolean;
  period_start: string;
  period_end: string;
  sales: string;
  amount: string;
  amountTyped: boolean; // once someone types an amount, stop overwriting it
};

const money = (text: string) => (text.trim() ? parseAud(text) : null);
const fixed = (n: number | null) => (n === null ? "" : n.toFixed(2));

export function PaymentForm({
  clientId,
  gstRegistered,
  sites,
  defaultStart,
  defaultEnd,
  today,
}: {
  clientId: string;
  gstRegistered: boolean;
  sites: CommissionSite[];
  defaultStart: string;
  defaultEnd: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordPayment.bind(null, clientId), {});

  const siteById = useMemo(() => new Map(sites.map((s) => [s.location_id, s])), [sites]);

  // Start with every site that has commission ticked, for last month.
  const [lines, setLines] = useState<Line[]>(() =>
    sites.map((s) => {
      const suggested = suggestedCommission(s.commission_type, s.commission_rate, null, defaultStart, defaultEnd);
      return {
        location_id: s.location_id,
        include: s.commission_type !== "none",
        period_start: defaultStart,
        period_end: defaultEnd,
        sales: "",
        amount: fixed(suggested),
        amountTyped: false,
      };
    }),
  );
  const [gst, setGst] = useState<string | null>(null); // null = work it out

  function update(i: number, patch: Partial<Line>) {
    setLines((all) =>
      all.map((line, j) => {
        if (j !== i) return line;
        const next = { ...line, ...patch };
        if (!next.amountTyped) {
          const site = siteById.get(next.location_id)!;
          next.amount = fixed(
            suggestedCommission(site.commission_type, site.commission_rate, money(next.sales), next.period_start, next.period_end),
          );
        }
        return next;
      }),
    );
  }

  const included = lines.filter((l) => l.include);
  const subtotal = cents(included.reduce((sum, l) => sum + (money(l.amount) ?? 0), 0));
  // GST-registered clients charge 10% on top of their commission.
  const autoGst = gstRegistered ? cents(subtotal * 0.1) : 0;
  const gstValue = gst === null ? autoGst : (money(gst) ?? 0);
  const total = cents(subtotal + gstValue);

  // What the server gets: the ticked lines, as typed.
  const payload = JSON.stringify(
    included.map((l) => ({
      location_id: l.location_id,
      period_start: l.period_start,
      period_end: l.period_end,
      sales: l.sales,
      amount: l.amount,
    })),
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="lines" value={payload} />

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Sites this payment covers</h2>
        {lines.map((line, i) => {
          const site = siteById.get(line.location_id)!;
          const isPercent = site.commission_type === "percentage";
          return (
            <fieldset
              key={line.location_id}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${
                line.include ? "border-zinc-300" : "border-zinc-200 opacity-60"
              }`}
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={line.include}
                  onChange={(e) => update(i, { include: e.target.checked })}
                  className="size-5 accent-brand-strong"
                />
                <span className="font-medium">{site.site_name}</span>
                <span className="text-sm text-zinc-500">{rateText(site.commission_type, site.commission_rate, formatAud)}</span>
              </label>
              {line.include && (
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field
                    label="From"
                    type="date"
                    value={line.period_start}
                    onChange={(e) => update(i, { period_start: e.target.value })}
                  />
                  <Field
                    label="To"
                    type="date"
                    value={line.period_end}
                    onChange={(e) => update(i, { period_end: e.target.value })}
                  />
                  <Field
                    label={isPercent ? "Sales ($)" : "Sales ($, optional)"}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={line.sales}
                    onChange={(e) => update(i, { sales: e.target.value })}
                  />
                  <Field
                    label="Commission ($)"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={line.amount}
                    onChange={(e) => update(i, { amount: e.target.value, amountTyped: true })}
                    hint={line.amountTyped ? "Typed in" : "Worked out for you"}
                  />
                </div>
              )}
            </fieldset>
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="section-title">Payment</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date paid" name="paid_on" type="date" max={today} defaultValue={v?.paid_on ?? today} required />
          <SelectField label="Method" name="method" options={PAYMENT_METHODS} defaultValue={v?.method ?? "bank_transfer"} />
          <Field label="Reference (optional)" name="reference" placeholder="Bank ref or cheque no." defaultValue={v?.reference ?? ""} />
        </div>

        <dl className="grid gap-2 rounded-2xl bg-white ring-2 ring-zinc-200 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Commission ({included.length} site{included.length === 1 ? "" : "s"})</dt>
            <dd>{formatAud(subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>
              GST{" "}
              <span className="text-zinc-500">
                {gstRegistered ? "(customer is GST registered: 10%)" : "(customer isn't GST registered)"}
              </span>
            </dt>
            <dd>
              <input
                name="gst"
                inputMode="decimal"
                aria-label="GST amount"
                value={gst ?? autoGst.toFixed(2)}
                onChange={(e) => setGst(e.target.value)}
                className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right"
              />
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-zinc-200 pt-2 text-base font-semibold">
            <dt>Total paid</dt>
            <dd>{formatAud(total)}</dd>
          </div>
        </dl>

        <TextAreaField label="Notes (optional)" name="notes" defaultValue={v?.notes ?? ""} />
      </section>

      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>Record payment of {formatAud(total)}</SubmitButton>
        <Link href={`/clients/${clientId}`} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
