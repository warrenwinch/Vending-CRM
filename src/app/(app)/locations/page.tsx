import Link from "next/link";
import { Suspense } from "react";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { listLocations } from "@/lib/locations";
import { LOCATION_STATUSES, isLocationStatus, type LocationStatus } from "@/lib/location-types";
import { LocationList } from "./location-list";

export default function LocationsPage({ searchParams }: PageProps<"/locations">) {
  return (
    <Suspense
      fallback={
        <>
          <h1 className="page-title">Locations</h1>
          <p className="text-sm text-zinc-500">Loading locations…</p>
        </>
      }
    >
      <Locations searchParams={searchParams} />
    </Suspense>
  );
}

async function Locations({ searchParams }: Pick<PageProps<"/locations">, "searchParams">) {
  const { profile } = await requireProfile();
  const canEdit = OFFICE_ROLES.includes(profile.role);

  const params = await searchParams;
  const status = isLocationStatus(params.status) ? params.status : undefined;
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const locations = await listLocations({ status, search });

  const filterHref = (s?: LocationStatus) => {
    const qs = new URLSearchParams();
    if (s) qs.set("status", s);
    if (search) qs.set("q", search);
    const str = qs.toString();
    return str ? `/locations?${str}` : "/locations";
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">Locations</h1>
        {canEdit && (
          <Link
            href="/locations/new"
            className="btn-primary"
          >
            Add location
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Filter by status">
          {[{ value: undefined, label: "All" }, ...LOCATION_STATUSES].map((s) => (
            <Link
              key={s.label}
              href={filterHref(s.value)}
              className={`rounded-full px-4 py-2 font-bold ${
                status === s.value
                  ? "chip-active"
                  : "chip"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <form action="/locations" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search site or address"
            className="input w-full sm:w-60"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      <LocationList
        locations={locations}
        showClient={canEdit}
        empty={
          search || status
            ? "No locations match."
            : canEdit
              ? "No locations yet. Click “Add location”, or add one from a client's page."
              : "No locations yet."
        }
      />
    </>
  );
}
