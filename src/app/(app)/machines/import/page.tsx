import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { ImportMachines } from "./import-machines";

export default function ImportMachinesPage() {
  return (
    <>
      <div>
        <Link href="/machines" className="text-sm font-medium text-zinc-500 underline">
          Machines
        </Link>
        <h1 className="page-title">Import machines from a CSV file</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Importer />
      </Suspense>
    </>
  );
}

async function Importer() {
  const { profile } = await requireRole(MACHINE_EDIT_ROLES);
  return <ImportMachines allowCost={OFFICE_ROLES.includes(profile.role)} />;
}
