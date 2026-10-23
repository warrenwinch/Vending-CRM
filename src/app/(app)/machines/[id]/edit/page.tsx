import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getMachine } from "@/lib/machines";
import { getOpenPlacement } from "@/lib/placements";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { isUuid } from "@/lib/ids";
import { MachineForm } from "../../machine-form";

export default function EditMachinePage({ params }: PageProps<"/machines/[id]/edit">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Edit machine</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditMachine params={params} />
      </Suspense>
    </>
  );
}

async function EditMachine({ params }: Pick<PageProps<"/machines/[id]/edit">, "params">) {
  const { profile } = await requireRole(MACHINE_EDIT_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [machine, placement] = await Promise.all([getMachine(id), getOpenPlacement(id)]);
  if (!machine) notFound();

  return (
    <MachineForm
      machine={machine}
      showCost={OFFICE_ROLES.includes(profile.role)}
      placedAt={placement?.site_name}
    />
  );
}
