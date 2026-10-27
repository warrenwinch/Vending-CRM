import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { getMachine } from "@/lib/machines";
import { getPlacementHistory } from "@/lib/placements";
import { NotesSection } from "../../notes/notes-section";
import { listFaults } from "@/lib/faults";
import { FaultList } from "../../faults/fault-list";
import { MACHINE_EDIT_ROLES, MACHINE_TYPES } from "@/lib/machine-types";
import { isUuid } from "@/lib/ids";
import { formatAud, formatDate, todayInSydney } from "@/lib/au";
import { MachineStatusBadge } from "../machine-status-badge";
import { listDone, listPlans } from "@/lib/maintenance";
import { PlanList } from "../../maintenance/plan-list";
import { DoneList } from "../../maintenance/done-list";
import { listMachineTags, listTags } from "@/lib/tags";
import { MachineTags } from "../tag-forms";

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
  const [machine, history, allFaults, plans, doneJobs, tags, allTags] = await Promise.all([
    getMachine(id),
    getPlacementHistory(id),
    listFaults({ machineId: id }),
    listPlans({ machineId: id }),
    listDone({ machineId: id, limit: 5 }),
    listMachineTags(id),
    listTags(),
  ]);
  // Open faults first, then the 5 most recent fixed ones.
  const faults = [...allFaults.filter((f) => !f.fixed_at), ...allFaults.filter((f) => f.fixed_at).slice(0, 5)];
  if (!machine) notFound();
  const current = history.find((p) => p.ended_on === null);

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
          <h1 className="flex flex-wrap items-center gap-3 page-title">
            <span className="font-mono">{machine.machine_number}</span>
            <MachineStatusBadge status={machine.status} />
          </h1>
        </div>
        {canEdit && (
          <Link
            href={`/machines/${machine.id}/edit`}
            className="btn-secondary"
          >
            Edit
          </Link>
        )}
      </div>

      <dl className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="break-words sm:col-span-2">{value || <span className="text-zinc-400">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-title">Tags</h2>
          <Link href="/machines/tags" className="text-sm font-medium text-zinc-500 underline">
            All tags
          </Link>
        </div>
        <MachineTags machineId={machine.id} tags={tags} allTags={allTags} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Location</h2>
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {current ? (
              <>
                At{" "}
                <Link href={`/locations/${current.location_id}`} className="font-medium underline">
                  {current.site_name}
                </Link>
                {current.position && <>, {current.position}</>} since {formatDate(current.started_on)}
              </>
            ) : (
              <span className="text-zinc-500">Not at a location</span>
            )}
          </p>
          {canEdit && machine.status !== "retired" && (
            <div className="flex gap-2">
              <Link
                href={`/machines/${machine.id}/place`}
                className="btn-primary"
              >
                {current ? "Move" : "Place at a location"}
              </Link>
              {current && (
                <Link
                  href={`/machines/${machine.id}/take-out`}
                  className="btn-secondary"
                >
                  Take out
                </Link>
              )}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-zinc-500">History</h3>
            <ol className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
              {history.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 p-3">
                  <span>
                    <Link href={`/locations/${p.location_id}`} className="font-medium underline">
                      {p.site_name}
                    </Link>
                    {p.position && <span className="text-zinc-600">, {p.position}</span>}
                  </span>
                  <span className="text-zinc-500">
                    {formatDate(p.started_on)} – {p.ended_on ? formatDate(p.ended_on) : "now"}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-title">Faults</h2>
          <Link
            href={`/machines/${machine.id}/report-fault`}
            className="btn-danger"
          >
            Report a fault
          </Link>
        </div>
        <FaultList faults={faults} showMachine={false} empty="No faults recorded for this machine." />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-title">Maintenance</h2>
          {OFFICE_ROLES.includes(profile.role) && machine.status !== "retired" && (
            <Link href={`/maintenance/new?machine=${machine.id}`} className="btn-secondary">
              Add maintenance
            </Link>
          )}
        </div>
        <PlanList plans={plans} today={todayInSydney()} showMachine={false} empty="No regular maintenance for this machine." />
        {doneJobs.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-zinc-500">Recently done</h3>
            <DoneList jobs={doneJobs} showTask empty="" />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-2 ring-zinc-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">Public QR sticker</h2>
          <p className="text-sm text-zinc-600">
            Anyone at the site can scan it to report a problem without logging in. Reports appear under Faults as “Public report”.
          </p>
        </div>
        <Link href={`/machines/${machine.id}/label`} className="btn-secondary shrink-0">
          Show / print sticker
        </Link>
      </section>

      <NotesSection target={{ kind: "machine", id: machine.id }} canDelete={OFFICE_ROLES.includes(profile.role)} />
    </>
  );
}
