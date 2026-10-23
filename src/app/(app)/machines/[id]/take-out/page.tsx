import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getMachine } from "@/lib/machines";
import { getOpenPlacement, placeName } from "@/lib/placements";
import { MACHINE_EDIT_ROLES } from "@/lib/machine-types";
import { isUuid } from "@/lib/ids";
import { formatDate, todayInSydney } from "@/lib/au";
import { TakeOutForm } from "../placement-forms";

export default function TakeOutPage({ params }: PageProps<"/machines/[id]/take-out">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <TakeOut params={params} />
    </Suspense>
  );
}

async function TakeOut({ params }: Pick<PageProps<"/machines/[id]/take-out">, "params">) {
  await requireRole(MACHINE_EDIT_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [machine, current] = await Promise.all([getMachine(id), getOpenPlacement(id)]);
  if (!machine) notFound();
  if (!current) redirect(`/machines/${id}`);

  return (
    <>
      <div>
        <Link href={`/machines/${id}`} className="text-sm font-medium text-zinc-500 underline">
          {machine.machine_number}
        </Link>
        <h1 className="page-title">Take {machine.machine_number} out</h1>
        <p className="mt-1 text-zinc-600">
          At {placeName(current)} since {formatDate(current.started_on)}.
        </p>
      </div>
      <TakeOutForm machineId={id} today={todayInSydney()} since={current.started_on} />
    </>
  );
}
