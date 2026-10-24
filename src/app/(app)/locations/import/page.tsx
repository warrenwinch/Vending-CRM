import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listClientOptions } from "@/lib/locations";
import { ImportLocations } from "./import-locations";

export default function ImportLocationsPage() {
  return (
    <>
      <div>
        <Link href="/locations" className="text-sm font-medium text-zinc-500 underline">
          Locations
        </Link>
        <h1 className="page-title">Import locations from a CSV file</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Importer />
      </Suspense>
    </>
  );
}

async function Importer() {
  await requireRole(OFFICE_ROLES);
  const clients = await listClientOptions();
  if (clients.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
        Every location belongs to a client.{" "}
        <Link href="/clients/import" className="font-medium underline">
          Import or add your clients first
        </Link>
        .
      </p>
    );
  }
  return <ImportLocations clients={clients} />;
}
