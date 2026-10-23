import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { getMachine } from "@/lib/machines";
import { MACHINE_EDIT_ROLES, MACHINE_TYPES } from "@/lib/machine-types";
import { isUuid } from "@/lib/ids";
import { formatAud, formatDate } from "@/lib/au";
import { MachineStatusBadge } from "../machine-status-badge";

export default function MachinePage({ params }: PageProps<"/machines/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <MachineDetails params={params} />
    </Suspense>
  );
}

async function MachineDetails({ params }: Pick<PageProps<"/machines/[id]">, "params">) {
  const { profile } = await requireProfile();
  const canEdit = MACHINE_EDIT_ROLES.includes(profile.role);

  const { id } = await params;
  if (!isUuid(id)) notFound();
  const machine = await getMachine(id);
  if (!machine) notFound();

  const rows: [string, string | null][] = [
    ["Type", MACHINE_TYPES.find((t) => t.value === machine.type)?.label ?? null],
    ["Manufacturer", machine.manufacturer],
    ["Model", machine.model],
    ["Serial number", machine.serial_number],
    ["Payment hardware", machine.payment_hardware],
    ["Purchase date", formatDate(machine.purchase_date)],
  ];
  // What a machine cost stays with Administrators and Managers.
  if (OFFICE_ROLES.includes(profile.role)) {
    rows.push(["Purchase cost", machine.purchase_cost === null ? null : formatAud(machine.purchase_cost)]);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/machines" className="text-sm font-medium text-zinc-500 underline">
            Machines
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="font-mono">{machine.machine_number}</span>
            <MachineStatusBadge status={machine.status} />
          </h1>
        </div>
        {canEdit && (
          <Link
            href={`/machines/${machine.id}/edit`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Edit
          </Link>
        )}
      </div>

      <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="break-words sm:col-span-2">{value || <span className="text-zinc-400">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>

      <p className="text-sm text-zinc-500">Placing this machine at a location comes in the next step.</p>
    </>
  );
}
