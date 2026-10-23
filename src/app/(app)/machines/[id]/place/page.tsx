import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getMachine } from "@/lib/machines";
import { getOpenPlacement } from "@/lib/placements";
import { listPlaceableLocations } from "@/lib/locations";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { isUuid } from "@/lib/ids";
import { formatDate, todayInSydney } from "@/lib/au";
import { PlaceForm } from "../placement-forms";

export default function PlaceMachinePage({ params }: PageProps<"/machines/[id]/place">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Place params={params} />
    </Suspense>
  );
}

async function Place({ params }: Pick<PageProps<"/machines/[id]/place">, "params">) {
  await requireRole(MACHINE_EDIT_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [machine, current, locations] = await Promise.all([
    getMachine(id),
    getOpenPlacement(id),
    listPlaceableLocations(),
  ]);
  if (!machine) notFound();

  const others = locations.filter((l) => l.value !== current?.location_id);

  return (
    <>
      <div>
        <Link href={`/machines/${id}`} className="text-sm font-medium text-zinc-500 underline">
          {machine.machine_number}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {current ? `Move ${machine.machine_number}` : `Place ${machine.machine_number}`}
        </h1>
        {current && (
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Now at {current.site_name} since {formatDate(current.started_on)}.
          </p>
        )}
      </div>

      {machine.status === "retired" ? (
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          This machine is retired. Edit it and change its status before placing it.
        </p>
      ) : others.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          There are no other locations to place it at. Add a location first.
        </p>
      ) : (
        <PlaceForm machineId={id} locations={others} today={todayInSydney()} moving={Boolean(current)} />
      )}
    </>
  );
}
