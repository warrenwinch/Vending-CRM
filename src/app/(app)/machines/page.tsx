import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { listMachines } from "@/lib/machines";
import { openFaultCounts } from "@/lib/faults";
import {
  MACHINE_EDIT_ROLES,
  MACHINE_STATUSES,
  MACHINE_TYPES,
  isMachineStatus,
  type MachineStatus,
} from "@/lib/machine-types";
import { MachineStatusBadge, machineRowTint } from "./machine-status-badge";

export default function MachinesPage({ searchParams }: PageProps<"/machines">) {
  return (
    <Suspense
      fallback={
        <>
          <h1 className="page-title">Machines</h1>
          <p className="text-sm text-zinc-500">Loading machines…</p>
        </>
      }
    >
      <Machines searchParams={searchParams} />
    </Suspense>
  );
}

async function Machines({ searchParams }: Pick<PageProps<"/machines">, "searchParams">) {
  const { profile } = await requireProfile();
  const canEdit = MACHINE_EDIT_ROLES.includes(profile.role);

  const params = await searchParams;
  const status = isMachineStatus(params.status) ? params.status : undefined;
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const [machines, { byMachine }] = await Promise.all([listMachines({ status, search }), openFaultCounts()]);

  const filterHref = (s?: MachineStatus) => {
    const qs = new URLSearchParams();
    if (s) qs.set("status", s);
    if (search) qs.set("q", search);
    const str = qs.toString();
    return str ? `/machines?${str}` : "/machines";
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">Machines</h1>
        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/machines/labels" className="btn-secondary">
              QR stickers
            </Link>
            <Link
              href="/machines/import"
              className="btn-secondary"
            >
              Import CSV
            </Link>
            <Link
              href="/machines/new"
              className="btn-primary"
            >
              Add machine
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Filter by status">
          {[{ value: undefined, label: "All" }, ...MACHINE_STATUSES].map((s) => (
            <Link
              key={s.label}
              href={filterHref(s.value)}
              className={`rounded-full px-4 py-2 font-bold ${
                status === s.value
                  ? "chip-active"
                  : "chip"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <form action="/machines" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Site, number, serial, make or model"
            className="input w-full sm:w-64"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {machines.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          {search || status
            ? "No machines match."
            : canEdit
              ? "No machines yet. Click “Add machine” to add your first one."
              : "No machines yet."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
          {machines.map((m) => (
            <li key={m.id}>
              <Link
                href={`/machines/${m.id}`}
                className={`flex items-center gap-4 border-l-8 p-4 ${machineRowTint[m.status]}`}
              >
                <span className="w-20 shrink-0 font-mono text-sm font-semibold">{m.machine_number}</span>
                <div className="min-w-0 flex-1">
                  {/* Where it is comes first: that's what people look for on the road. */}
                  <p className={`truncate ${m.site_name ? "font-bold" : "font-medium text-zinc-500"}`}>
                    {m.site_name ?? "Not at a location"}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {[
                      [m.manufacturer, m.model].filter(Boolean).join(" ") || null,
                      MACHINE_TYPES.find((t) => t.value === m.type)?.label,
                      m.serial_number && `S/N ${m.serial_number}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {byMachine.get(m.id) ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-red-900">
                    {byMachine.get(m.id)} open fault{byMachine.get(m.id) === 1 ? "" : "s"}
                  </span>
                ) : null}
                <MachineStatusBadge status={m.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
