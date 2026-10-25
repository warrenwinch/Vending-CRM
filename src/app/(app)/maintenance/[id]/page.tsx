import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { describeEvery, getPlan, listDone } from "@/lib/maintenance";
import { isUuid } from "@/lib/ids";
import { formatDate, todayInSydney } from "@/lib/au";
import { DeletePlanButton, MarkDoneForm } from "../maintenance-forms";
import { DueBadge } from "../plan-list";
import { DoneList } from "../done-list";

export default function PlanPage({ params, searchParams }: PageProps<"/maintenance/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <PlanDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanDetails({ params, searchParams }: Pick<PageProps<"/maintenance/[id]">, "params" | "searchParams">) {
  const { profile } = await requireProfile();
  const isOffice = OFFICE_ROLES.includes(profile.role);
  const { id } = await params;
  const { done } = await searchParams;
  if (!isUuid(id)) notFound();

  const [plan, history] = await Promise.all([getPlan(id), listDone({ planId: id, limit: 20 })]);
  if (!plan) notFound();
  const today = todayInSydney();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/maintenance" className="text-sm font-medium text-zinc-500 underline">
            Maintenance
          </Link>
          <h1 className="page-title">{plan.task}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-zinc-700">
            <Link href={`/machines/${plan.machine_id}`} className="font-mono font-semibold underline">
              {plan.machine_number}
            </Link>
            <span>{plan.site_name ?? "In storage"}</span>
          </p>
        </div>
        {isOffice && (
          <Link href={`/maintenance/${plan.id}/edit`} className="btn-secondary">
            Edit
          </Link>
        )}
      </div>

      {done === "1" && (
        <p aria-live="polite" className="rounded-xl border-l-8 border-leaf bg-leaf-soft p-4 font-medium text-leaf-deep">
          Done, thanks. Next due {formatDate(plan.next_due)}.
        </p>
      )}

      <dl className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
        <div className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-zinc-500">Next due</dt>
          <dd className="sm:col-span-2">
            <DueBadge nextDue={plan.next_due} today={today} />
          </dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-zinc-500">How often</dt>
          <dd className="sm:col-span-2">{describeEvery(plan.every_count, plan.every_unit)}, counted from when it was last done</dd>
        </div>
        {plan.notes && (
          <div className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">Notes</dt>
            <dd className="whitespace-pre-line sm:col-span-2">{plan.notes}</dd>
          </div>
        )}
      </dl>

      {plan.machine_status !== "retired" && (
        <section className="flex flex-col gap-3">
          <h2 className="section-title">Mark done</h2>
          <MarkDoneForm planId={plan.id} today={today} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">History</h2>
        <DoneList jobs={history} showTask={false} empty="Not done yet." />
      </section>

      {isOffice && <DeletePlanButton planId={plan.id} machineId={plan.machine_id} />}
    </>
  );
}
