// Machines filled and variances for Yesterday, Week to date and Month to date,
// used on the Stock variances page and on Home.
import Link from "next/link";
import { addDays } from "@/lib/sales-import";
import { varianceTotals } from "@/lib/variance-import";
import type { RunMachine, Variance } from "@/lib/variances";

export type Period = { label: string; from: string; to: string };
export type Stats = { filled: number; short: number; over: number };

export const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const inPeriod = (date: string, p: Period) => date >= p.from && date <= p.to;

// The same periods as Home's sales: complete days, up to yesterday.
export function variancePeriods(today: string): Period[] {
  const yesterday = addDays(today, -1);
  const monday = addDays(yesterday, -((new Date(`${yesterday}T00:00:00Z`).getUTCDay() + 6) % 7));
  return [
    { label: "Yesterday", from: yesterday, to: yesterday },
    { label: "Week to date", from: monday, to: yesterday },
    { label: "Month to date", from: `${yesterday.slice(0, 8)}01`, to: yesterday },
  ];
}

export function statsFor(rows: Variance[], machines: RunMachine[], p: Period): Stats {
  const { short, over } = varianceTotals(rows.filter((r) => inPeriod(r.ticket_date, p)));
  return { filled: machines.filter((m) => inPeriod(m.ticket_date, p)).length, short, over };
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

// Three figures for each of the three periods, one line per driver or machine.
export function PeriodTable({
  first,
  periods,
  lines,
  total,
}: {
  first: string;
  periods: Period[];
  lines: { key: string; name: React.ReactNode; stats: Stats[]; highlight?: boolean }[];
  total?: Stats[]; // a last line adding up everyone
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
        {total && (
          <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-bold">
            <tr>
              <td className="min-w-40 p-3">Whole company</td>
              {total.map((s, i) => (
                <Figures key={i} stats={s} />
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// One line per driver who did anything in these periods; tapping one opens
// their machines on the Stock variances page.
export function driverLines(rows: Variance[], machines: RunMachine[], periods: Period[], selected = "") {
  const last = periods[0].to;
  const names = [
    ...new Map([...rows, ...machines].filter((r) => r.ticket_date <= last).map((r) => [r.driver_name.toLowerCase(), r.driver_name])).values(),
  ].sort((a, b) => a.localeCompare(b));
  return names.map((name) => ({
    key: name,
    highlight: sameName(name, selected),
    name: (
      <Link href={`/sales/variances?${new URLSearchParams({ driver: name })}`} className="font-bold underline">
        {name}
      </Link>
    ),
    stats: periods.map((p) =>
      statsFor(
        rows.filter((r) => sameName(r.driver_name, name)),
        machines.filter((m) => sameName(m.driver_name, name)),
        p,
      ),
    ),
  }));
}
