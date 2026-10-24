import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { getFault } from "@/lib/faults";
import { categoryLabel, formatDateTime, formatDuration, nowMs, timeToFix, FAULT_SEVERITIES } from "@/lib/fault-types";
import { isUuid } from "@/lib/ids";
import { DeleteFaultButton, MarkFixedForm } from "../fault-forms";

export default function FaultPage({ params }: PageProps<"/faults/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <FaultDetails params={params} />
    </Suspense>
  );
}

async function FaultDetails({ params }: Pick<PageProps<"/faults/[id]">, "params">) {
  const { profile } = await requireProfile();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const fault = await getFault(id);
  if (!fault) notFound();

  const fixedIn = timeToFix(fault);
  const rows: [string, React.ReactNode][] = [
    ["How bad", FAULT_SEVERITIES.find((s) => s.value === fault.severity)?.label],
    [
      "Site",
      fault.location_id ? (
        <Link href={`/locations/${fault.location_id}`} className="underline">
          {fault.site_name}
        </Link>
      ) : (
        "Not at a site"
      ),
    ],
    ["Found", `${formatDateTime(fault.reported_at)} by ${fault.reporter_name}`],
  ];
  if (fault.reported_by_public) {
    rows.push(["Their contact details", fault.reporter_contact ?? "None given"]);
  }
  if (fault.fixed_at) {
    rows.push(["Fixed", `${formatDateTime(fault.fixed_at)} by ${fault.fixer_name}`]);
    rows.push(["Time to fix", formatDuration(fixedIn!)]);
    if (fault.fix_notes) rows.push(["What was done", fault.fix_notes]);
  } else {
    rows.push(["Open for", formatDuration(nowMs() - new Date(fault.reported_at).getTime())]);
  }

  return (
    <>
      <div>
        <Link href={`/machines/${fault.machine_id}`} className="font-mono text-sm font-medium text-zinc-500 underline">
          {fault.machine_number}
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 page-title">
          {categoryLabel(fault.category)}
          {fault.fixed_at ? (
            <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-medium text-leaf-deep">
              Fixed
            </span>
          ) : (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900">
              Open
            </span>
          )}
        </h1>
        <p className="mt-2 whitespace-pre-line">{fault.description}</p>
      </div>

      <dl className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="whitespace-pre-line sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>

      {!fault.fixed_at && <MarkFixedForm faultId={fault.id} />}
      {OFFICE_ROLES.includes(profile.role) && <DeleteFaultButton faultId={fault.id} machineId={fault.machine_id} />}
    </>
  );
}
