import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { formatDate, todayInSydney } from "@/lib/au";
import { addDays } from "@/lib/sales-import";
import { isNotAPerson, listMembers } from "@/lib/team";
import { varianceTotals } from "@/lib/variance-import";
import { assetMachines, listRunMachines, listVarianceDrivers, listVariances, type RunMachine, type Variance } from "@/lib/variances";
import { DeleteRunButton, ImportVariances } from "./import-variances";

export default function VariancesPage({ searchParams }: PageProps<"/sales/variances">) {
  return (
    <>
      <div>
        <Link href="/sales" className="text-sm font-medium text-zinc-500 underline">
          Sales
        </Link>
        <h1 className="page-title">Stock variances</h1>
        <p className="mt-1 text-zinc-600">Machines filled, and what drivers counted against what Seed expected.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Variances searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Period = { label: string; from: string; to: string };
type Stats = { filled: number; short: number; over: number };

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const inPeriod = (date: string, p: Period) => date >= p.from && date <= p.to;

function statsFor(rows: Variance[], machines: RunMachine[], p: Period): Stats {
  const { short, over } = varianceTotals(rows.filter((r) => inPeriod(r.ticket_date, p)));
  return { filled: machines.filter((m) => inPeriod(m.ticket_date, p)).length, short, over };
}

// Three figures for each of the three periods, one line per driver or machine.
function PeriodTable({
  first,
  periods,
  lines,
}: {
  first: string;
  periods: Period[];
  lines: { key: string; name: React.ReactNode; stats: Stats[]; highlight?: boolean }[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            <th rowSpan={2} className="p-3 text-left align-bottom">
              {first}
            </th>
            {periods.map((p) => (
              <th key={p.label} colSpan={3} className="border-l border-zinc-200 p-2 text-center whitespace-nowrap">
                {p.label}
              </th>
            ))}
          </tr>
          <tr>
            {periods.map((p) => (
              <Heads key={p.label} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {lines.map((l) => (
            <tr key={l.key} className={l.highlight ? "bg-brand-soft" : ""}>
              <td className="min-w-40 p-3">{l.name}</td>
              {l.stats.map((s, i) => (
                <Figures key={i} stats={s} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Heads() {
  return (
    <>
      <th className="border-l border-zinc-200 p-2 text-right font-medium">Filled</th>
      <th className="p-2 text-right font-medium">Short</th>
      <th className="p-2 text-right font-medium">Over</th>
    </>
  );
}

function Figures({ stats }: { stats: Stats }) {
  return (
    <>
      <td className="border-l border-zinc-200 p-2 text-right">{stats.filled}</td>
      <td className={`p-2 text-right font-bold ${stats.short ? "text-red-700" : ""}`}>{stats.short}</td>
      <td className="p-2 text-right">{stats.over}</td>
    </>
  );
}

async function Variances({ searchParams }: Pick<PageProps<"/sales/variances">, "searchParams">) {
  await requireRole(OFFICE_ROLES);
  const { driver: driverParam, machine: machineParam } = await searchParams;
  const driver = typeof driverParam === "string" ? driverParam : "";
  const asset = typeof machineParam === "string" ? machineParam : "";

  // The same periods as Home's sales: complete days, up to yesterday.
  const today = todayInSydney();
  const yesterday = addDays(today, -1);
  const monday = addDays(yesterday, -((new Date(`${yesterday}T00:00:00Z`).getUTCDay() + 6) % 7));
  const monthStart = `${yesterday.slice(0, 8)}01`;
  const periods: Period[] = [
    { label: "Yesterday", from: yesterday, to: yesterday },
    { label: "Week to date", from: monday, to: yesterday },
    { label: "Month to date", from: monthStart, to: yesterday },
  ];
  const from = monday < monthStart ? monday : monthStart;

  const [allRows, allMachines, usedDrivers, members, machineOf] = await Promise.all([
    listVariances(from, today),
    listRunMachines(from, today),
    listVarianceDrivers(),
    listMembers(),
    assetMachines(),
  ]);
  const rows = driver ? allRows.filter((r) => sameName(r.driver_name, driver)) : allRows;
  const machines = driver ? allMachines.filter((m) => sameName(m.driver_name, driver)) : allMachines;

  const driverChoices = [
    ...new Map(
      // Team members last, so their spelling wins over one typed on an earlier import.
      [...usedDrivers, ...members.filter((m) => m.active && !isNotAPerson(m.full_name)).map((m) => m.full_name)].map((n) => [n.toLowerCase(), n]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

  // A driver or machine is listed if it did anything in these periods.
  const inReport = (d: { ticket_date: string }) => d.ticket_date <= yesterday;
  const driverNames = [
    ...new Map([...allRows, ...allMachines].filter(inReport).map((r) => [r.driver_name.toLowerCase(), r.driver_name])).values(),
  ].sort((a, b) => a.localeCompare(b));
  const driverLines = driverNames.map((name) => ({
    key: name,
    highlight: sameName(name, driver),
    name: (
      <Link href={`/sales/variances?${new URLSearchParams({ driver: name })}`} className="font-bold underline">
        {name}
      </Link>
    ),
    stats: periods.map((p) =>
      statsFor(
        allRows.filter((r) => sameName(r.driver_name, name)),
        allMachines.filter((m) => sameName(m.driver_name, name)),
        p,
      ),
    ),
  }));

  const assets = [...new Set([...rows, ...machines].filter(inReport).map((r) => r.external_id))];
  const machineLines = assets
    .map((id) => {
      const stats = periods.map((p) =>
        statsFor(
          rows.filter((r) => r.external_id === id),
          machines.filter((m) => m.external_id === id),
          p,
        ),
      );
      const machine = machineOf(id);
      const qs = new URLSearchParams({ ...(driver ? { driver } : {}), machine: id });
      return {
        key: id,
        stats,
        highlight: id === asset,
        name: (
          <Link href={`/sales/variances?${qs}#items`} className="flex flex-col hover:underline">
            <span className="font-bold underline">{machine?.site_name ?? id}</span>
            <span className="text-xs text-zinc-500">
              {[machine?.machine_number, machine?.site_name && id, !machine && "Not matched to a machine"].filter(Boolean).join(" · ")}
            </span>
          </Link>
        ),
      };
    })
    .sort((a, b) => b.stats[2].short - a.stats[2].short || b.stats[2].filled - a.stats[2].filled || a.key.localeCompare(b.key));

  const items = asset ? rows.filter((r) => r.external_id === asset && inReport(r)).sort((a, b) => a.variance - b.variance || b.ticket_date.localeCompare(a.ticket_date)) : [];
  const itemMachine = asset ? machineOf(asset) : null;

  // Every run on file for these dates, newest first, so a wrong one can be removed.
  const runKey = (d: { ticket_date: string; driver_name: string }) => `${d.ticket_date}|${d.driver_name.toLowerCase()}`;
  const runs = [...new Map([...allRows, ...allMachines].map((r) => [runKey(r), r])).values()]
    .map((r) => ({
      key: runKey(r),
      date: r.ticket_date,
      driver: r.driver_name,
      filled: allMachines.filter((m) => runKey(m) === runKey(r)).length,
      counted: allRows.filter((c) => runKey(c) === runKey(r)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.driver.localeCompare(b.driver));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="section-title">Import a driver&apos;s report</h2>
        <ImportVariances yesterday={yesterday} today={today} drivers={driverChoices} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">{driver ? `Totals: ${driver}` : "Totals"}</h2>
          {driver && (
            <Link href="/sales/variances" className="btn-small">
              All drivers
            </Link>
          )}
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {periods.map((p) => {
            const s = statsFor(rows, machines, p);
            return (
              <div key={p.label} className="flex flex-col gap-1 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
                <dt className="text-sm font-bold text-zinc-600">{p.label}</dt>
                <dd className="font-display text-3xl font-extrabold">{s.filled} filled</dd>
                <dd className="text-sm">
                  <span className={`font-bold ${s.short ? "text-red-700" : ""}`}>{s.short} short</span> · {s.over} over
                </dd>
                <dd className="text-xs text-zinc-500">{p.from === p.to ? formatDate(p.from) : `${formatDate(p.from)} to ${formatDate(p.to)}`}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      {driverLines.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          No runs in these periods yet.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="section-title">By driver</h2>
            <PeriodTable first="Driver" periods={periods} lines={driverLines} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="section-title">By machine{driver && `: ${driver}`}</h2>
            <p className="text-sm text-zinc-600">Most short this month first. Tap a machine to see each item.</p>
            <PeriodTable first="Machine" periods={periods} lines={machineLines} />
          </section>

          {asset && (
            <section id="items" className="flex flex-col gap-3">
              <h2 className="section-title">Items: {itemMachine?.site_name ?? asset}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-zinc-500">No coils counted on this machine in these periods.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border-2 border-zinc-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-600">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Driver</th>
                        <th className="p-3">Coil</th>
                        <th className="p-3">Item</th>
                        <th className="p-3 text-right">Counted</th>
                        <th className="p-3 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {items.map((r) => (
                        <tr key={r.id}>
                          <td className="p-3 whitespace-nowrap">{formatDate(r.ticket_date)}</td>
                          <td className="p-3 whitespace-nowrap">{r.driver_name}</td>
                          <td className="p-3">{r.coil}</td>
                          <td className="p-3">{r.item_name}</td>
                          <td className="p-3 text-right">{r.observed}</td>
                          <td className={`p-3 text-right font-bold ${r.variance < 0 ? "text-red-700" : ""}`}>{signed(r.variance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {itemMachine && (
                <Link href={`/machines/${itemMachine.id}`} className="text-sm underline">
                  Open {itemMachine.machine_number}
                </Link>
              )}
            </section>
          )}
        </>
      )}

      {runs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="section-title">Imported runs</h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
            {runs.map((r) => {
              const t = varianceTotals(r.counted);
              return (
                <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span>
                    <span className="font-bold">{formatDate(r.date)}</span> {r.driver}: {r.filled} filled, {r.counted.length} counted, {t.short} short, {t.over} over
                    {r.date === today && <span className="block text-amber-800">Dated today, so it joins the totals from tomorrow.</span>}
                  </span>
                  <DeleteRunButton date={r.date} driver={r.driver} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
