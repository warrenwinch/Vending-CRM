import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getMachine } from "@/lib/machines";
import { getOpenPlacement, placeName } from "@/lib/placements";
import { isUuid } from "@/lib/ids";
import { reportUrl } from "@/lib/qr";
import { MachineLabel } from "../../machine-label";
import { PrintButton } from "../../print-button";

export default function MachineLabelPage({ params }: PageProps<"/machines/[id]/label">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Label params={params} />
    </Suspense>
  );
}

async function Label({ params }: Pick<PageProps<"/machines/[id]/label">, "params">) {
  await requireProfile();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [machine, placement] = await Promise.all([getMachine(id), getOpenPlacement(id)]);
  if (!machine) notFound();

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        <Link href={`/machines/${id}`} className="font-mono text-sm font-medium text-zinc-500 underline">
          {machine.machine_number}
        </Link>
        <h1 className="page-title">QR sticker</h1>
        <p className="text-zinc-600">
          Stick this on the front of the machine. Customers scan it to report a problem (it goes straight into Faults) or call the number. It shows where the machine is now, so print a new one if you move it.
        </p>
        <div className="flex flex-wrap gap-3">
          <PrintButton label="Print sticker" />
          <a href={reportUrl(machine.public_token)} target="_blank" className="btn-secondary">
            Try the customer page
          </a>
        </div>
      </div>
      <MachineLabel
        machineNumber={machine.machine_number}
        place={placement ? placeName(placement) : null}
        publicToken={machine.public_token}
      />
    </>
  );
}
