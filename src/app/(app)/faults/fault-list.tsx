// A list of faults, used on the Faults page and each machine's page.
import Link from "next/link";
import { categoryLabel, formatDateTime, formatDuration, nowMs, timeToFix, type Fault } from "@/lib/fault-types";

export function FaultList({ faults, showMachine, empty }: { faults: Fault[]; showMachine: boolean; empty: React.ReactNode }) {
  if (faults.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        {empty}
      </p>
    );
  }
  const now = nowMs();

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {faults.map((f) => {
        const fixedIn = timeToFix(f);
        return (
          <li key={f.id}>
            <Link href={`/faults/${f.id}`} className="flex flex-col gap-1 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-2">
                {showMachine && <span className="font-mono text-sm font-semibold">{f.machine_number}</span>}
                <span className="font-medium">{categoryLabel(f.category)}</span>
                {fixedIn === null ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      f.severity === "not_working"
                        ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    }`}
                  >
                    {f.severity === "not_working" ? "Not working" : "Partly working"} · open{" "}
                    {formatDuration(now - new Date(f.reported_at).getTime())}
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-900 dark:bg-green-950 dark:text-green-200">
                    Fixed in {formatDuration(fixedIn)}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{f.description}</p>
              <p className="text-xs text-zinc-500">
                {[showMachine ? f.site_name : null, `Found ${formatDateTime(f.reported_at)} by ${f.reporter_name}`]
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
