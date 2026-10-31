import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { listMachines } from "@/lib/machines";
import { DymoLabel, DymoPageSize, DymoPrintSteps, MachineLabel } from "../machine-label";
import { LabelSizeSwitch } from "../label-size-switch";
import { PrintButton } from "../print-button";

export default function AllLabelsPage({ searchParams }: PageProps<"/machines/labels">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Labels searchParams={searchParams} />
    </Suspense>
  );
}

async function Labels({ searchParams }: Pick<PageProps<"/machines/labels">, "searchParams">) {
  await requireProfile();
  const dymo = (await searchParams).size === "dymo";
  // Oldest first, so the sheet runs VM-001, VM-002…; retired machines are left out.
  const machines = (await listMachines({})).filter((m) => m.status !== "retired").reverse();
  const count = `${machines.length} sticker${machines.length === 1 ? "" : "s"}`;

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        <Link href="/machines" className="text-sm font-medium text-zinc-500 underline">
          Machines
        </Link>
        <h1 className="page-title">QR stickers for every machine</h1>
        <LabelSizeSwitch path="/machines/labels" dymo={dymo} />
        <p className="text-zinc-600">
          {dymo
            ? `${count}, one per Dymo label. `
            : `${count}, about 6.4 cm wide, three across an A4 page. Print on sticker paper, or on plain paper and laminate. `}
          Each shows where the machine is now, so reprint a machine&apos;s sticker if you move it.
        </p>
        {dymo && <DymoPrintSteps />}
        <div>
          <PrintButton label={`Print ${count}`} />
        </div>
      </div>
      {dymo && <DymoPageSize />}
      <div className={dymo ? "flex flex-wrap gap-[4mm] print:block" : "flex flex-wrap gap-[4mm]"}>
        {machines.map((m) =>
          dymo ? (
            <DymoLabel key={m.id} machineNumber={m.machine_number} place={m.site_name} publicToken={m.public_token} />
          ) : (
            <MachineLabel key={m.id} machineNumber={m.machine_number} place={m.site_name} publicToken={m.public_token} />
          ),
        )}
      </div>
    </>
  );
}
