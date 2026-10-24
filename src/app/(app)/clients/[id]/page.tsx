import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { listLocations } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { formatAbn, formatAud, formatDate } from "@/lib/au";
import { ArchiveButton } from "./archive-button";
import { describeCommission } from "@/lib/location-types";
import { StatusBadge } from "@/components/status-badge";
import { LocationList } from "../../locations/location-list";
import { listContacts } from "@/lib/contacts";
import { ContactList } from "./contacts/contact-list";
import { listPayments } from "@/lib/commission";
import { openFaultCounts } from "@/lib/faults";
import { PaymentList } from "../../commission/payment-list";
import { NotesSection } from "../../notes/notes-section";
import { listMachinesForCustomer } from "@/lib/placements";
import { MACHINE_TYPES } from "@/lib/machine-types";
import { MachineStatusBadge, machineRowTint } from "../../machines/machine-status-badge";

export default function ClientPage({ params }: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ClientDetails params={params} />
    </Suspense>
  );
}

async function ClientDetails({ params }: Pick<PageProps<"/clients/[id]">, "params">) {
  await requireRole(OFFICE_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [client, locations, contacts, payments, machines, { bySite, byMachine }] = await Promise.all([
    getClient(id),
    listLocations({ clientId: id }),
    listContacts({ clientId: id }),
    listPayments({ clientId: id }),
    listMachinesForCustomer(id),
    openFaultCounts(),
  ]);
  if (!client) notFound();

  const rows: [string, string | null][] = [
    ["ABN", formatAbn(client.abn)],
    ["GST registered", client.gst_registered ? "Yes" : "No"],
    ["Billing contact", client.billing_contact],
    ["Billing email", client.billing_email],
    ["Billing phone", client.billing_phone],
    ["Commission", `${describeCommission(client.commission_type, client.commission_rate, formatAud)} (for all sites unless a site has its own deal)`],
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/clients" className="text-sm font-medium text-zinc-500 underline">
            Customers
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 page-title">
            {client.company_name}
            <StatusBadge status={client.status} />
            {client.archived_at && (
              <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                Archived {formatDate(client.archived_at.slice(0, 10))}
              </span>
            )}
          </h1>
        </div>
        <Link
          href={`/clients/${client.id}/edit`}
          className="btn-secondary"
        >
          Edit
        </Link>
      </div>

      <dl className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="break-words sm:col-span-2">{value || <span className="text-zinc-400">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Contacts</h2>
        <Link
          href={`/clients/${client.id}/contacts/new`}
          className="btn-primary"
        >
          Add contact
        </Link>
      </div>
      <ContactList contacts={contacts} showSite empty="No contacts for this customer yet." />

      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Locations</h2>
        <Link
          href={`/locations/new?client=${client.id}`}
          className="btn-primary"
        >
          Add location
        </Link>
      </div>
      <LocationList
        locations={locations}
        showClient={false}
        openFaults={Object.fromEntries(bySite)}
        empty="No locations for this customer yet."
      />

      <h2 className="section-title">Machines ({machines.length})</h2>
      {machines.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-zinc-500">
          No machines at this customer&apos;s sites right now.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
          {machines.map((m) => (
            <li key={m.id}>
              <Link
                href={`/machines/${m.id}`}
                className={`flex items-center gap-4 border-l-8 p-4 ${machineRowTint[m.status]}`}
              >
                <span className="w-20 shrink-0 font-mono text-sm font-semibold">{m.machine_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{[m.site_name, m.position].filter(Boolean).join(", ")}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {[
                      [m.manufacturer, m.model].filter(Boolean).join(" ") || null,
                      MACHINE_TYPES.find((t) => t.value === m.type)?.label,
                      `since ${formatDate(m.started_on)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {byMachine.get(m.id) ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-red-900">
                    {byMachine.get(m.id)} open fault{byMachine.get(m.id) === 1 ? "" : "s"}
                  </span>
                ) : null}
                <MachineStatusBadge status={m.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Commission payments</h2>
        <Link
          href={`/commission/new?client=${client.id}`}
          className="btn-primary"
        >
          Record payment
        </Link>
      </div>
      <PaymentList payments={payments} showClient={false} empty="No commission paid to this customer yet." />

      <NotesSection target={{ kind: "client", id: client.id }} canDelete />

      <ArchiveButton clientId={client.id} archived={Boolean(client.archived_at)} />
    </>
  );
}
