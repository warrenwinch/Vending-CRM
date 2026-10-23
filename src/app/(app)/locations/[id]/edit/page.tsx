import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getLocation, listClientOptions } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { LocationForm } from "../../location-form";

export default function EditLocationPage({ params }: PageProps<"/locations/[id]/edit">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Edit location</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditLocation params={params} />
      </Suspense>
    </>
  );
}

async function EditLocation({ params }: Pick<PageProps<"/locations/[id]/edit">, "params">) {
  await requireRole(OFFICE_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [location, clients] = await Promise.all([getLocation(id), listClientOptions()]);
  if (!location) notFound();

  return <LocationForm location={location} clients={clients} cancelHref={`/locations/${id}`} />;
}
