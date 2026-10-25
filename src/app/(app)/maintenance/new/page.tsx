import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listMachineChoices, SUGGESTED_TASKS } from "@/lib/maintenance";
import { isUuid } from "@/lib/ids";
import { todayInSydney } from "@/lib/au";
import { AddPlansForm } from "../maintenance-forms";

export default function NewMaintenancePage({ searchParams }: PageProps<"/maintenance/new">) {
  return (
    <>
      <div>
        <Link href="/maintenance" className="text-sm font-medium text-zinc-500 underline">
          Maintenance
        </Link>
        <h1 className="page-title">Add regular maintenance</h1>
        <p className="mt-1 text-zinc-600">
          Tick one machine, a whole site, or several sites. Each machine gets its own copy of the job.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading machines…</p>}>
        <NewPlan searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewPlan({ searchParams }: Pick<PageProps<"/maintenance/new">, "searchParams">) {
  await requireRole(OFFICE_ROLES);
  const { machine } = await searchParams;
  const machineId = typeof machine === "string" && isUuid(machine) ? machine : null;
  const machines = await listMachineChoices();

  return (
    <AddPlansForm
      machines={machines}
      preselected={machineId ? [machineId] : []}
      today={todayInSydney()}
      suggestions={SUGGESTED_TASKS}
      back={machineId ? `/machines/${machineId}` : "/maintenance"}
    />
  );
}
