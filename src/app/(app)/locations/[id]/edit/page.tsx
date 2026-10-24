import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getLocation, listClientOptions } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { LocationForm } from "../../location-form";
import { DeleteLocation } from "./delete-location";

export default function EditLocationPage({ params }: PageProps<"/locations/[id]/edit">) {
  return (
    <>
      <h1 className="page-title">Edit location</h1>
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

  const location = await getLocation(id);
  if (!location) notFound();
  // Keep this site's own customer in the list even if it's archived.
  const clients = await listClientOptions({ keep: location.client_id });

  return (
    <>
      <LocationForm location={location} clients={clients} cancelHref={`/locations/${id}`} />
      <DeleteLocation locationId={location.id} siteName={location.site_name} />
    </>
  );
}
