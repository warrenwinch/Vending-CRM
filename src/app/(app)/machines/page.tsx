import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { listMachines } from "@/lib/machines";
import {
  MACHINE_EDIT_ROLES,
  MACHINE_STATUSES,
  MACHINE_TYPES,
  isMachineStatus,
  type MachineStatus,
} from "@/lib/machine-types";
import { MachineStatusBadge } from "./machine-status-badge";

export default function MachinesPage({ searchParams }: PageProps<"/machines">) {
  return (
    <Suspense
      fallback={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
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
  const machines = await listMachines({ status, search });

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
        <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Link
              href="/machines/import"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Import CSV
            </Link>
            <Link
              href="/machines/new"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
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
              className={`rounded-full px-3 py-1.5 font-medium ${
                status === s.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
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
            placeholder="Number, serial, make or model"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900 sm:w-60 sm:text-sm"
          />
          <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700">
            Search
          </button>
        </form>
      </div>

      {machines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          {search || status
            ? "No machines match."
            : canEdit
              ? "No machines yet. Click “Add machine” to add your first one."
              : "No machines yet."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {machines.map((m) => (
            <li key={m.id}>
              <Link
                href={`/machines/${m.id}`}
                className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="w-20 shrink-0 font-mono text-sm font-semibold">{m.machine_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {[m.manufacturer, m.model].filter(Boolean).join(" ") ||
                      MACHINE_TYPES.find((t) => t.value === m.type)?.label}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {[
                      MACHINE_TYPES.find((t) => t.value === m.type)?.label,
                      m.serial_number && `S/N ${m.serial_number}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <MachineStatusBadge status={m.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
