import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { getLocation } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { formatAud } from "@/lib/au";
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
  const location = await getLocation(id);
  if (!location) notFound();

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
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {location.site_name}
            <StatusBadge status={location.status} />
          </h1>
        </div>
        {isOffice && (
          <Link
            href={`/locations/${location.id}/edit`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Edit
          </Link>
        )}
      </div>

      <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="whitespace-pre-line sm:col-span-2">{value || <span className="text-zinc-400">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>

      <p className="text-sm text-zinc-500">Machines at this site will appear here once machines are added.</p>
    </>
  );
}
