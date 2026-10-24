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
        <h1 className="page-title">Customers</h1>
        <div className="flex gap-2">
          <Link
            href="/clients/import"
            className="btn-secondary"
          >
            Import CSV
          </Link>
          <Link
            href="/clients/new"
            className="btn-primary"
          >
            Add customer
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading customers…</p>}>
        <ClientList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ClientList({ searchParams }: Pick<PageProps<"/clients">, "searchParams">) {
  await requireRole(OFFICE_ROLES);

  const params = await searchParams;
  const archived = params.archived === "1";
  const status = !archived && isClientStatus(params.status) ? params.status : undefined;
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const clients = await listClients({ status, search, archived });

  const filterHref = (s?: ClientStatus, showArchived = false) => {
    const qs = new URLSearchParams();
    if (showArchived) qs.set("archived", "1");
    else if (s) qs.set("status", s);
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
              className={`rounded-full px-4 py-2 font-bold ${
                !archived && status === s.value
                  ? "chip-active"
                  : "chip"
              }`}
            >
              {s.label}
            </Link>
          ))}
          {/* Archived customers are hidden from the other views. */}
          <Link
            href={filterHref(undefined, true)}
            className={`rounded-full px-4 py-2 font-bold ${archived ? "chip-active" : "chip text-zinc-500"}`}
          >
            Archived
          </Link>
        </nav>
        <form action="/clients" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {archived && <input type="hidden" name="archived" value="1" />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search name or contact"
            className="input w-full sm:w-60"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {clients.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          {archived
            ? "No archived customers."
            : search || status
              ? "No customers match."
              : "No customers yet. Click “Add customer” to add your first one."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="flex flex-col gap-1 p-4 hover:bg-brand-soft sm:flex-row sm:items-center sm:gap-4"
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
