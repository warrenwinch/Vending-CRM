import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getMachine } from "@/lib/machines";
import { getOpenPlacement, placeName } from "@/lib/placements";
import { isUuid } from "@/lib/ids";
import { ReportFaultForm } from "../../../faults/fault-forms";

export default function ReportFaultPage({ params }: PageProps<"/machines/[id]/report-fault">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ReportFault params={params} />
    </Suspense>
  );
}

async function ReportFault({ params }: Pick<PageProps<"/machines/[id]/report-fault">, "params">) {
  await requireProfile();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [machine, placement] = await Promise.all([getMachine(id), getOpenPlacement(id)]);
  if (!machine) notFound();

  return (
    <>
      <div>
        <Link href={`/machines/${id}`} className="font-mono text-sm font-medium text-zinc-500 underline">
          {machine.machine_number}
        </Link>
        <h1 className="page-title">Report a fault</h1>
        {placement && <p className="mt-1 text-zinc-600">At {placeName(placement)}</p>}
      </div>
      <ReportFaultForm machineId={id} />
    </>
  );
}
