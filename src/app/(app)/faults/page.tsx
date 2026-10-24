import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { listFaults } from "@/lib/faults";
import { categoryLabel, formatDuration, nowMs, timeToFix, type FaultCategory } from "@/lib/fault-types";
import { FaultList } from "./fault-list";
import { SendSummaryNow } from "./fault-forms";

export default function FaultsPage({ searchParams }: PageProps<"/faults">) {
  return (
    <>
      <h1 className="page-title">Faults</h1>
      {/* Reporting starts by finding the machine, then tapping "Report a fault" on its page. */}
      <form action="/machines" className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-2 ring-zinc-200 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-bold">Report a fault: find the machine</span>
          <input type="search" name="q" required placeholder="Site name, address or machine number" className="input" />
        </label>
        <button type="submit" className="btn-primary">
          Find machine
        </button>
      </form>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading faults…</p>}>
        <Faults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const DAY = 24 * 60 * 60 * 1000;

async function Faults({ searchParams }: Pick<PageProps<"/faults">, "searchParams">) {
  const { profile } = await requireProfile();
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
          <div key={label} className="rounded-2xl border-2 border-zinc-200 bg-white p-3">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="section-title">{value}</dd>
          </div>
        ))}
      </dl>
      {top.length > 0 && (
        <p className="text-sm text-zinc-600">
          Most common in the last 90 days: {top.map(([c, n]) => `${categoryLabel(c)} (${n})`).join(", ")}.
        </p>
      )}
      {profile.role === "administrator" && <SendSummaryNow />}

      <nav className="flex flex-wrap gap-1 text-sm" aria-label="Show">
        {[
          ["open", `Open (${open.length})`],
          ["fixed", "Fixed"],
          ["all", "All"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value === "open" ? "/faults" : `/faults?show=${value}`}
            className={`rounded-full px-4 py-2 font-bold ${
              view === value
                ? "chip-active"
                : "chip"
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
