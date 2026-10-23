import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listClientOptions } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { LocationForm } from "../location-form";

export default function NewLocationPage({ searchParams }: PageProps<"/locations/new">) {
  return (
    <>
      <h1 className="page-title">Add a location</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewLocation searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewLocation({ searchParams }: Pick<PageProps<"/locations/new">, "searchParams">) {
  await requireRole(OFFICE_ROLES);
  const { client } = await searchParams;
  const clientId = isUuid(client) ? client : undefined;
  const clients = await listClientOptions();

  if (clients.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
        Every location belongs to a client.{" "}
        <Link href="/clients/new" className="font-medium underline">
          Add a client first
        </Link>
        .
      </p>
    );
  }

  return (
    <LocationForm
      clients={clients}
      clientId={clientId}
      cancelHref={clientId ? `/clients/${clientId}` : "/locations"}
    />
  );
}
