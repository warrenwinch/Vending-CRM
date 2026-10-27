// A list of faults, used on the Faults page and each machine's page.
import Link from "next/link";
import { categoryLabel, formatDateTime, formatDuration, nowMs, timeToFix, type Fault } from "@/lib/fault-types";

export function FaultList({ faults, showMachine, empty }: { faults: Fault[]; showMachine: boolean; empty: React.ReactNode }) {
  if (faults.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
        {empty}
      </p>
    );
  }
  const now = nowMs();

  return (
    <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
      {faults.map((f) => {
        const fixedIn = timeToFix(f);
        return (
          <li key={f.id}>
            <Link href={`/faults/${f.id}`} className="flex flex-col gap-1 p-4 hover:bg-brand-soft">
              <div className="flex flex-wrap items-center gap-2">
                {showMachine && <span className="font-mono text-sm font-semibold">{f.machine_number}</span>}
                {/* Where and what: the two things a Filler needs at a glance. */}
                {f.site_name && <span className="font-bold text-brand-deep">{f.site_name}</span>}
                {f.site_name && <span className="text-zinc-400">·</span>}
                <span className="font-bold">{categoryLabel(f.category)}</span>
                {f.reported_by_public && (
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900">Public report</span>
                )}
                {fixedIn === null ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      f.severity === "not_working"
                        ? "bg-red-100 text-red-900"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {f.severity === "not_working" ? "Not working" : "Partly working"} · open{" "}
                    {formatDuration(now - new Date(f.reported_at).getTime())}
                  </span>
                ) : (
                  <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-medium text-leaf-deep">
                    Fixed in {formatDuration(fixedIn)}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-zinc-600">{f.description}</p>
              <p className="text-xs text-zinc-500">
                {[
                  `Found ${formatDateTime(f.reported_at)} by ${f.reporter_name}`,
                  !f.fixed_at && (f.assigned_name ? `Assigned to ${f.assigned_name}` : "Not assigned"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
