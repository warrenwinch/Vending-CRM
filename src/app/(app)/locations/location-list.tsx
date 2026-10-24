// A list of locations, used on the Locations page and on each client's page.
import Link from "next/link";
import { LOCATION_TYPES, labelOf, type Location } from "@/lib/location-types";
import { StatusBadge } from "@/components/status-badge";

export function LocationList({
  locations,
  showClient,
  empty,
  openFaults = {},
}: {
  locations: Location[];
  showClient: boolean;
  openFaults?: Record<string, number>; // open faults per site, for a red badge
  empty: React.ReactNode;
}) {
  if (locations.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
      {locations.map((l) => (
        <li key={l.id}>
          <Link
            href={`/locations/${l.id}`}
            className="flex flex-col gap-1 p-4 hover:bg-brand-soft sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.site_name}</p>
              <p className="truncate text-sm text-zinc-500">
                {[showClient ? l.client_name : null, l.address?.replace(/\s*\n\s*/g, ", ")]
                  .filter(Boolean)
                  .join(" · ") || "No address"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {openFaults[l.id] ? (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-red-900">
                  {openFaults[l.id]} open fault{openFaults[l.id] === 1 ? "" : "s"}
                </span>
              ) : null}
              <span className="text-zinc-500">{labelOf(LOCATION_TYPES, l.type)}</span>
              <StatusBadge status={l.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
