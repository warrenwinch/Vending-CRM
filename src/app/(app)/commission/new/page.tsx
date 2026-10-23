import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { listCommissionSites } from "@/lib/commission";
import { listClientOptions } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { lastMonthInSydney, todayInSydney } from "@/lib/au";
import { PaymentForm } from "./payment-form";

export default function NewPaymentPage({ searchParams }: PageProps<"/commission/new">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <NewPayment searchParams={searchParams} />
    </Suspense>
  );
}

async function NewPayment({ searchParams }: Pick<PageProps<"/commission/new">, "searchParams">) {
  await requireRole(OFFICE_ROLES);
  const { client } = await searchParams;

  // Step 1: choose who is being paid.
  if (!isUuid(client)) {
    const clients = await listClientOptions();
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Record a commission payment</h1>
        <form action="/commission/new" className="flex max-w-lg flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Which client are you paying?</span>
            <select
              name="client"
              required
              className="rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="self-start rounded-md bg-zinc-900 px-4 py-3 text-base font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Next
          </button>
        </form>
      </>
    );
  }

  // Step 2: which sites, what periods, how much.
  const [found, sites] = await Promise.all([getClient(client), listCommissionSites(client)]);
  if (!found) notFound();
  const [start, end] = lastMonthInSydney();

  return (
    <>
      <div>
        <Link href={`/clients/${found.id}`} className="text-sm font-medium text-zinc-500 underline">
          {found.company_name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Record a commission payment</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sites with commission are ticked for last month. For a % site, enter its sales and the commission is worked out;
          for a fixed site it&apos;s the monthly amount times the months. You can type over any amount.
        </p>
      </div>
      {sites.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          This client has no sites yet. Add a location with commission first.
        </p>
      ) : (
        <PaymentForm
          clientId={found.id}
          gstRegistered={found.gst_registered}
          sites={sites}
          defaultStart={start}
          defaultEnd={end}
          today={todayInSydney()}
        />
      )}
    </>
  );
}
