import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { CLIENT_STATUSES, isClientStatus, type ClientStatus } from "@/lib/client-types";
import { formatAbn } from "@/lib/au";
import { StatusBadge } from "@/components/status-badge";

export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <Link
          href="/clients/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add client
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading clients…</p>}>
        <ClientList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ClientList({ searchParams }: Pick<PageProps<"/clients">, "searchParams">) {
  await requireRole(OFFICE_ROLES);

  const params = await searchParams;
  const status = isClientStatus(params.status) ? params.status : undefined;
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const clients = await listClients({ status, search });

  const filterHref = (s?: ClientStatus) => {
    const qs = new URLSearchParams();
    if (s) qs.set("status", s);
    if (search) qs.set("q", search);
    const str = qs.toString();
    return str ? `/clients?${str}` : "/clients";
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Filter by status">
          {[{ value: undefined, label: "All" }, ...CLIENT_STATUSES].map((s) => (
            <Link
              key={s.label}
              href={filterHref(s.value)}
              className={`rounded-full px-3 py-1.5 font-medium ${
                status === s.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <form action="/clients" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search name or contact"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900 sm:w-56 sm:text-sm"
          />
          <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700">
            Search
          </button>
        </form>
      </div>

      {clients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          {search || status ? "No clients match." : "No clients yet. Click “Add client” to add your first one."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="flex flex-col gap-1 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.company_name}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {[c.billing_contact, c.billing_email, c.billing_phone].filter(Boolean).join(" · ") ||
                      "No billing contact"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {c.abn && <span className="text-zinc-500">ABN {formatAbn(c.abn)}</span>}
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
