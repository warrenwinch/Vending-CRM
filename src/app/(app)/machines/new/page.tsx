import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { MachineForm } from "../machine-form";

export default function NewMachinePage() {
  return (
    <>
      <h1 className="page-title">Add a machine</h1>
      <p className="text-zinc-600">
        The machine number (VM-001, VM-002…) is given automatically when you save.
      </p>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewMachine />
      </Suspense>
    </>
  );
}

async function NewMachine() {
  const { profile } = await requireRole(MACHINE_EDIT_ROLES);
  return <MachineForm showCost={OFFICE_ROLES.includes(profile.role)} />;
}
