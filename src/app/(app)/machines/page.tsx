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
import { listTags } from "@/lib/tags";
import { tagChipClass } from "@/lib/tag-types";
import { isUuid } from "@/lib/ids";

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
  // ?tag=…&tag=… : machines with every tag chosen.
  const tagIds = [params.tag].flat().filter((t): t is string => typeof t === "string" && isUuid(t));
  const [machines, { byMachine }, allTags] = await Promise.all([
    listMachines({ status, search, tagIds }),
    openFaultCounts(),
    listTags(),
  ]);

  const filterHref = (s: MachineStatus | undefined, tags: string[] = tagIds) => {
    const qs = new URLSearchParams();
    if (s) qs.set("status", s);
    if (search) qs.set("q", search);
    tags.forEach((t) => qs.append("tag", t));
    const str = qs.toString();
    return str ? `/machines?${str}` : "/machines";
  };
  const toggleTag = (id: string) =>
    filterHref(status, tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id]);

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
          {tagIds.map((t) => (
            <input key={t} type="hidden" name="tag" value={t} />
          ))}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Site, number, tag, serial or model"
            className="input w-full sm:w-64"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Filter by tag">
          <span className="font-bold text-zinc-600">Tags:</span>
          {allTags.length === 0 && <span className="text-zinc-500">none yet</span>}
          {allTags.map((t) => {
            const on = tagIds.includes(t.id);
            return (
              <Link
                key={t.id}
                href={toggleTag(t.id)}
                aria-pressed={on}
                className={`rounded-full px-3 py-1.5 font-bold ${tagChipClass(t.colour)} ${on ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100"}`}
              >
                {on && "✓ "}
                {t.name}
              </Link>
            );
          })}
          {tagIds.length > 0 && (
            <Link href={filterHref(status, [])} className="font-medium underline">
              Clear tags
            </Link>
          )}
          <Link href="/machines/tags" className="ml-auto font-medium text-zinc-500 underline">
            Manage tags
          </Link>
        </nav>

      {machines.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          {search || status || tagIds.length
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
                className={`flex items-start gap-3 border-l-8 p-4 ${machineRowTint[m.status]}`}
              >
                {/* Nothing is cut off, so on a phone several machines at one
                    site can be told apart by number, position and type. */}
                <div className="min-w-0 flex-1">
                  <p className={`break-words ${m.site ? "font-bold" : "font-medium text-zinc-500"}`}>
                    {m.site ?? "Not at a location"}
                  </p>
                  <p className="break-words">
                    <span className="font-mono font-semibold">{m.machine_number}</span>
                    {[m.position, MACHINE_TYPES.find((t) => t.value === m.type)?.label]
                      .filter(Boolean)
                      .map((part) => (
                        <span key={part} className="font-semibold">
                          {" · "}
                          {part}
                        </span>
                      ))}
                  </p>
                  {m.tags.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {m.tags.map((t) => (
                        <span key={t.id} className={`rounded-full px-2 py-0.5 text-xs font-bold ${tagChipClass(t.colour)}`}>
                          {t.name}
                        </span>
                      ))}
                    </p>
                  )}
                  {(m.manufacturer || m.model || m.serial_number) && (
                    <p className="break-words text-sm text-zinc-500">
                      {[
                        [m.manufacturer, m.model].filter(Boolean).join(" ") || null,
                        m.serial_number && `S/N ${m.serial_number}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <MachineStatusBadge status={m.status} />
                  {byMachine.get(m.id) ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-red-900">
                      {byMachine.get(m.id)} open fault{byMachine.get(m.id) === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
