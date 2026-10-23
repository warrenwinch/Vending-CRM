import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { listLocations } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { formatAbn } from "@/lib/au";
import { StatusBadge } from "@/components/status-badge";
import { LocationList } from "../../locations/location-list";
import { listContacts } from "@/lib/contacts";
import { ContactList } from "./contacts/contact-list";
import { listPayments } from "@/lib/commission";
import { PaymentList } from "../../commission/payment-list";
import { NotesSection } from "../../notes/notes-section";

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

  const [client, locations, contacts, payments] = await Promise.all([
    getClient(id),
    listLocations({ clientId: id }),
    listContacts({ clientId: id }),
    listPayments({ clientId: id }),
  ]);
  if (!client) notFound();

  const rows: [string, string | null][] = [
    ["ABN", formatAbn(client.abn)],
    ["GST registered", client.gst_registered ? "Yes" : "No"],
    ["Billing contact", client.billing_contact],
    ["Billing email", client.billing_email],
    ["Billing phone", client.billing_phone],
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/clients" className="text-sm font-medium text-zinc-500 underline">
            Clients
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {client.company_name}
            <StatusBadge status={client.status} />
          </h1>
        </div>
        <Link
          href={`/clients/${client.id}/edit`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Edit
        </Link>
      </div>

      <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="break-words sm:col-span-2">{value || <span className="text-zinc-400">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <Link
          href={`/clients/${client.id}/contacts/new`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add contact
        </Link>
      </div>
      <ContactList contacts={contacts} showSite empty="No contacts for this client yet." />

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Locations</h2>
        <Link
          href={`/locations/new?client=${client.id}`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add location
        </Link>
      </div>
      <LocationList locations={locations} showClient={false} empty="No locations for this client yet." />

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Commission payments</h2>
        <Link
          href={`/commission/new?client=${client.id}`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Record payment
        </Link>
      </div>
      <PaymentList payments={payments} showClient={false} empty="No commission paid to this client yet." />

      <NotesSection target={{ kind: "client", id: client.id }} canDelete />
    </>
  );
}
