import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { listMachines } from "@/lib/machines";
import { MachineLabel } from "../machine-label";
import { PrintButton } from "../print-button";

export default function AllLabelsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Labels />
    </Suspense>
  );
}

async function Labels() {
  await requireProfile();
  // Oldest first, so the sheet runs VM-001, VM-002…; retired machines are left out.
  const machines = (await listMachines({})).filter((m) => m.status !== "retired").reverse();

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        <Link href="/machines" className="text-sm font-medium text-zinc-500 underline">
          Machines
        </Link>
        <h1 className="page-title">QR stickers for every machine</h1>
        <p className="text-zinc-600">
          {machines.length} sticker{machines.length === 1 ? "" : "s"}, about 6.4 cm wide, three across an A4 page.
          Print on sticker paper, or on plain paper and laminate.
        </p>
        <div>
          <PrintButton label={`Print ${machines.length} sticker${machines.length === 1 ? "" : "s"}`} />
        </div>
      </div>
      <div className="flex flex-wrap gap-[4mm]">
        {machines.map((m) => (
          <MachineLabel key={m.id} machineNumber={m.machine_number} publicToken={m.public_token} />
        ))}
      </div>
    </>
  );
}
