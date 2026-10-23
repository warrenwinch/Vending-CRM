// A list of commission payments, used on the Commission page and each client's page.
import Link from "next/link";
import { PAYMENT_METHODS, type PaymentSummary } from "@/lib/commission-types";
import { formatAud, formatDate } from "@/lib/au";

export function PaymentList({
  payments,
  showClient,
  empty,
}: {
  payments: PaymentSummary[];
  showClient: boolean;
  empty: React.ReactNode;
}) {
  if (payments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {payments.map((p) => (
        <li key={p.id}>
          <Link
            href={`/commission/${p.id}`}
            className="flex flex-col gap-1 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="w-24 shrink-0 text-sm text-zinc-500">{formatDate(p.paid_on)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {showClient ? p.client_name : p.site_names.join(", ")}
              </p>
              <p className="truncate text-sm text-zinc-500">
                {[
                  showClient ? p.site_names.join(", ") : null,
                  PAYMENT_METHODS.find((m) => m.value === p.method)?.label,
                  p.reference,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="font-semibold">{formatAud(p.total_amount_paid)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
