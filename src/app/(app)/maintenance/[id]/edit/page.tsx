import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getPlan, SUGGESTED_TASKS } from "@/lib/maintenance";
import { isUuid } from "@/lib/ids";
import { todayInSydney } from "@/lib/au";
import { EditPlanForm } from "../../maintenance-forms";

export default function EditPlanPage({ params }: PageProps<"/maintenance/[id]/edit">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <EditPlan params={params} />
    </Suspense>
  );
}

async function EditPlan({ params }: Pick<PageProps<"/maintenance/[id]/edit">, "params">) {
  await requireRole(OFFICE_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const plan = await getPlan(id);
  if (!plan) notFound();

  return (
    <>
      <div>
        <Link href={`/maintenance/${id}`} className="text-sm font-medium text-zinc-500 underline">
          {plan.task}
        </Link>
        <h1 className="page-title">Edit maintenance for {plan.machine_number}</h1>
      </div>
      <EditPlanForm
        planId={id}
        today={todayInSydney()}
        suggestions={SUGGESTED_TASKS}
        initial={{
          task: plan.task,
          every_count: String(plan.every_count),
          every_unit: plan.every_unit,
          next_due: plan.next_due,
          notes: plan.notes ?? "",
        }}
      />
    </>
  );
}
