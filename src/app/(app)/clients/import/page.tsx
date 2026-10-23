import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { ImportClients } from "./import-clients";

export default function ImportClientsPage() {
  return (
    <>
      <div>
        <Link href="/clients" className="text-sm font-medium text-zinc-500 underline">
          Clients
        </Link>
        <h1 className="page-title">Import clients from a CSV file</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Importer />
      </Suspense>
    </>
  );
}

async function Importer() {
  await requireRole(OFFICE_ROLES);
  return <ImportClients />;
}
