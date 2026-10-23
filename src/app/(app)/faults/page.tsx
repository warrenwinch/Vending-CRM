import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { listFaults } from "@/lib/faults";
import { categoryLabel, formatDuration, nowMs, timeToFix, type FaultCategory } from "@/lib/fault-types";
import { FaultList } from "./fault-list";

export default function FaultsPage({ searchParams }: PageProps<"/faults">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Faults</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        To report a fault, open the machine from Machines and tap “Report a fault”.
      </p>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading faults…</p>}>
        <Faults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const DAY = 24 * 60 * 60 * 1000;

async function Faults({ searchParams }: Pick<PageProps<"/faults">, "searchParams">) {
  await requireProfile();
  const { show } = await searchParams;
  const view = show === "fixed" ? "fixed" : show === "all" ? "all" : "open";

  const all = await listFaults();
  const open = all.filter((f) => !f.fixed_at);
  const now = nowMs();

  // Last 30 days of fixes: how many, average and longest time to fix.
  const recentFixes = all.filter((f) => f.fixed_at && now - new Date(f.fixed_at).getTime() <= 30 * DAY);
  const durations = recentFixes.map((f) => timeToFix(f)!);
  const average = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const longest = durations.length ? Math.max(...durations) : null;

  // Most common problems in the last 90 days.
  const counts = new Map<FaultCategory, number>();
  for (const f of all.filter((f) => now - new Date(f.reported_at).getTime() <= 90 * DAY)) {
    counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const shown = view === "open" ? open : view === "fixed" ? all.filter((f) => f.fixed_at) : all;

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Open now", String(open.length)],
          ["Fixed (30 days)", String(recentFixes.length)],
          ["Average time to fix", average === null ? "–" : formatDuration(average)],
          ["Longest (30 days)", longest === null ? "–" : formatDuration(longest)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {top.length > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Most common in the last 90 days: {top.map(([c, n]) => `${categoryLabel(c)} (${n})`).join(", ")}.
        </p>
      )}

      <nav className="flex flex-wrap gap-1 text-sm" aria-label="Show">
        {[
          ["open", `Open (${open.length})`],
          ["fixed", "Fixed"],
          ["all", "All"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value === "open" ? "/faults" : `/faults?show=${value}`}
            className={`rounded-full px-3 py-1.5 font-medium ${
              view === value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <FaultList
        faults={shown}
        showMachine
        empty={view === "open" ? "No open faults. Nice." : "No faults recorded yet."}
      />
    </>
  );
}
