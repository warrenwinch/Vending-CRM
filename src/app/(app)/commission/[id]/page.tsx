import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getPayment } from "@/lib/commission";
import { PAYMENT_METHODS, rateText } from "@/lib/commission-types";
import { formatAud, formatDate } from "@/lib/au";
import { isUuid } from "@/lib/ids";
import { DeletePaymentButton } from "./delete-button";

export default function PaymentPage({ params }: PageProps<"/commission/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <PaymentDetails params={params} />
    </Suspense>
  );
}

async function PaymentDetails({ params }: Pick<PageProps<"/commission/[id]">, "params">) {
  await requireRole(OFFICE_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const payment = await getPayment(id);
  if (!payment) notFound();

  const subtotal = payment.total_amount_paid - payment.gst_amount;

  return (
    <>
      <div>
        <Link href="/commission" className="text-sm font-medium text-zinc-500 underline">
          Commission payments
        </Link>
        <h1 className="page-title">
          {formatAud(payment.total_amount_paid)} to{" "}
          <Link href={`/clients/${payment.client_id}`} className="underline">
            {payment.client_name}
          </Link>
        </h1>
        <p className="mt-1 text-zinc-600">
          Paid {formatDate(payment.paid_on)} by {PAYMENT_METHODS.find((m) => m.value === payment.method)?.label.toLowerCase()}
          {payment.reference && <> · Ref {payment.reference}</>}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600">
            <tr>
              <th className="p-3 font-medium">Site</th>
              <th className="p-3 font-medium">Period</th>
              <th className="p-3 font-medium">Rate</th>
              <th className="p-3 text-right font-medium">Sales</th>
              <th className="p-3 text-right font-medium">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {payment.lines.map((l) => (
              <tr key={l.id}>
                <td className="p-3">
                  {l.location_id ? (
                    <Link href={`/locations/${l.location_id}`} className="font-medium underline">
                      {l.site_name}
                    </Link>
                  ) : (
                    <span className="font-medium">{l.site_name}</span>
                  )}
                </td>
                <td className="whitespace-nowrap p-3">
                  {formatDate(l.period_start)} – {formatDate(l.period_end)}
                </td>
                <td className="p-3">{rateText(l.rate_type, l.rate_applied, formatAud)}</td>
                <td className="p-3 text-right">{l.sales_amount === null ? "" : formatAud(l.sales_amount)}</td>
                <td className="p-3 text-right">{formatAud(l.commission_amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-200">
            <tr>
              <td colSpan={4} className="p-3 text-right text-zinc-500">Commission</td>
              <td className="p-3 text-right">{formatAud(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="p-3 text-right text-zinc-500">GST</td>
              <td className="p-3 text-right">{formatAud(payment.gst_amount)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={4} className="p-3 text-right">Total paid</td>
              <td className="p-3 text-right">{formatAud(payment.total_amount_paid)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {payment.notes && <p className="whitespace-pre-line text-sm text-zinc-600">{payment.notes}</p>}

      <DeletePaymentButton paymentId={payment.id} />
    </>
  );
}
