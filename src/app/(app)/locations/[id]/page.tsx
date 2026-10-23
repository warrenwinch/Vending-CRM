import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { getLocation } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { formatAud, formatDate } from "@/lib/au";
import { listMachinesAtLocation } from "@/lib/placements";
import { listContacts } from "@/lib/contacts";
import { NotesSection } from "../../notes/notes-section";
import { ContactList } from "../../clients/[id]/contacts/contact-list";
import { MACHINE_TYPES } from "@/lib/machine-types";
import { LOCATION_TYPES, labelOf, type Location } from "@/lib/location-types";
import { StatusBadge } from "@/components/status-badge";

export default function LocationPage({ params }: PageProps<"/locations/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <LocationDetails params={params} />
    </Suspense>
  );
}

function commissionText(l: Location) {
  if (l.commission_type === "none" || l.commission_rate === null) return "None";
  return l.commission_type === "percentage"
    ? `${l.commission_rate}% of sales`
    : `${formatAud(l.commission_rate)} per month`;
}

async function LocationDetails({ params }: Pick<PageProps<"/locations/[id]">, "params">) {
  const { profile } = await requireProfile();
  const isOffice = OFFICE_ROLES.includes(profile.role);

  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [location, machines] = await Promise.all([getLocation(id), listMachinesAtLocation(id)]);
  if (!location) notFound();

  // Contacts are office-only: this site's own contacts, plus the client's whole-company ones.
  const contacts = isOffice
    ? (await listContacts({ clientId: location.client_id })).filter((c) => c.location_id === null || c.location_id === id)
    : [];

  // Fillers and Warehouse see what they need on site; commission stays with the office.
  const rows: [string, React.ReactNode][] = [
    ["Address", location.address],
    ["Where the machines go", location.placement_notes],
    ["Access instructions", location.access_instructions],
    ["Operating hours", location.operating_hours],
    ["Foot traffic", location.foot_traffic],
    ["Type of site", labelOf(LOCATION_TYPES, location.type)],
  ];
  if (isOffice) rows.push(["Commission", commissionText(location)]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {isOffice && location.client_name && (
            <Link href={`/clients/${location.client_id}`} className="text-sm font-medium text-zinc-500 underline">
              {location.client_name}
            </Link>
          )}
          <h1 className="flex flex-wrap items-center gap-3 page-title">
            {location.site_name}
            <StatusBadge status={location.status} />
          </h1>
        </div>
        {isOffice && (
          <Link
            href={`/locations/${location.id}/edit`}
            className="btn-secondary"
          >
            Edit
          </Link>
        )}
      </div>

      <dl className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="whitespace-pre-line sm:col-span-2">{value || <span className="text-zinc-400">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>

      {isOffice && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="section-title">Contacts</h2>
            <Link
              href={`/clients/${location.client_id}/contacts/new?location=${location.id}`}
              className="btn-secondary"
            >
              Add contact
            </Link>
          </div>
          <ContactList contacts={contacts} showSite empty="No contacts for this site yet." />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Machines here</h2>
        {machines.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
            No machines at this site. Place one from its page under Machines.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
            {machines.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/machines/${m.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-brand-soft"
                >
                  <span className="font-mono font-semibold">{m.machine_number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {[m.manufacturer, m.model].filter(Boolean).join(" ") ||
                        MACHINE_TYPES.find((t) => t.value === m.type)?.label}
                    </span>
                    {m.position && <span className="block truncate text-zinc-500">{m.position}</span>}
                  </span>
                  <span className="text-zinc-500">since {formatDate(m.started_on)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NotesSection target={{ kind: "location", id: location.id }} canDelete={isOffice} />
    </>
  );
}
