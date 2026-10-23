import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listPayments } from "@/lib/commission";
import { formatAud, todayInSydney } from "@/lib/au";
import { PaymentList } from "./payment-list";

export default function CommissionPage() {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Commission payments</h1>
        <Link
          href="/commission/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Record payment
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading payments…</p>}>
        <Payments />
      </Suspense>
    </>
  );
}

async function Payments() {
  await requireRole(OFFICE_ROLES);
  const payments = await listPayments();

  // Australian financial year: 1 July to 30 June.
  const [year, month] = todayInSydney().split("-").map(Number);
  const fyStartYear = month >= 7 ? year : year - 1;
  const fyStart = `${fyStartYear}-07-01`;
  const thisYear = payments.filter((p) => p.paid_on >= fyStart);
  const fyTotal = thisYear.reduce((sum, p) => sum + p.total_amount_paid, 0);

  return (
    <>
      <p className="rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
        Paid this financial year (from 01/07/{fyStartYear}):{" "}
        <span className="font-semibold">{formatAud(fyTotal)}</span> across {thisYear.length} payment
        {thisYear.length === 1 ? "" : "s"}.
      </p>
      <PaymentList
        payments={payments}
        showClient
        empty="No commission payments yet. Click “Record payment” to add one."
      />
    </>
  );
}
