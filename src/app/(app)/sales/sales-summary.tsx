// The sales section on Home (Administrators and Managers only): the latest
// imported month against the one before, the trend, best and worst
// machines, and the biggest customers.
import Link from "next/link";
import { formatAud } from "@/lib/au";
import { monthlyTotals, salesForMonth, type MachineMonthSale } from "@/lib/sales";
import { SALES_SOURCES } from "@/lib/sales-import";
import { SalesTrend } from "./sales-trend";

const monthName = (month: string) =>
  new Date(`${month}T00:00:00`).toLocaleDateString("en-AU", { month: "long", year: "numeric" });

function Change({ now, before }: { now: number; before: number | undefined }) {
  if (!before) return null;
  const pct = ((now - before) / before) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-sm font-bold ${up ? "text-leaf-deep" : "text-red-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% on last month
    </span>
  );
}

function MachineList({ title, rows }: { title: string; rows: MachineMonthSale[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <h3 className="text-sm font-bold text-zinc-600">{title}</h3>
      <ol className="flex flex-col gap-1 text-sm">
        {rows.map((r, i) => (
          <li key={`${r.machine_id ?? r.label}-${i}`} className="flex justify-between gap-3">
            {r.machine_id ? (
              <Link href={`/machines/${r.machine_id}`} className="min-w-0 truncate underline">
                {r.label}
              </Link>
            ) : (
              <span className="min-w-0 truncate text-zinc-500">{r.label}</span>
            )}
            <span className="shrink-0 font-bold">{formatAud(r.amount)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export async function SalesSummary() {
  const months = await monthlyTotals(12);
  if (months.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="section-title">Sales</h2>
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-zinc-500">
          No sales imported yet.{" "}
          <Link href="/sales" className="font-medium underline">
            Import last month&apos;s reports
          </Link>
          .
        </p>
      </section>
    );
  }

  const latest = months[months.length - 1];
  const previous = months[months.length - 2];
  const machines = await salesForMonth(latest.month);
  const matched = machines.filter((m) => m.machine_id);
  const top = matched.slice(0, 5);
  const bottom = matched.length > 5 ? [...matched].reverse().slice(0, 5) : [];

  const byCustomer = new Map<string, number>();
  for (const m of machines) byCustomer.set(m.customer, Math.round(((byCustomer.get(m.customer) ?? 0) + m.amount) * 100) / 100);
  const customers = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]);
  const shownCustomers = customers.slice(0, 8);
  const otherCustomers = customers.slice(8).reduce((t, [, v]) => t + v, 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Sales: {monthName(latest.month)}</h2>
        <Link href="/sales" className="btn-small">
          Import
        </Link>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-4xl font-extrabold">{formatAud(latest.total)}</span>
          <Change now={latest.total} before={previous?.total} />
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600">
          {SALES_SOURCES.filter((s) => latest.bySource[s.value] !== undefined).map((s) => (
            <li key={s.value}>
              {s.label}: <span className="font-bold text-ink">{formatAud(latest.bySource[s.value]!)}</span>
            </li>
          ))}
        </ul>
        {previous && (
          <p className="text-sm text-zinc-500">
            {monthName(previous.month)}: {formatAud(previous.total)}
          </p>
        )}
      </div>

      {months.length > 1 && <SalesTrend months={months} />}

      <div className="grid gap-3 md:grid-cols-2">
        {top.length > 0 && <MachineList title="Top 5 machines" rows={top} />}
        {bottom.length > 0 && <MachineList title="Bottom 5 machines" rows={bottom} />}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
        <h3 className="text-sm font-bold text-zinc-600">By customer</h3>
        <ol className="flex flex-col gap-1 text-sm">
          {shownCustomers.map(([name, amount]) => (
            <li key={name} className="flex justify-between gap-3">
              <span className={`min-w-0 truncate ${name === "Not matched to a machine" ? "text-zinc-500" : ""}`}>{name}</span>
              <span className="shrink-0 font-bold">{formatAud(amount)}</span>
            </li>
          ))}
          {otherCustomers > 0 && (
            <li className="flex justify-between gap-3 text-zinc-500">
              <span>{customers.length - 8} other customers</span>
              <span className="shrink-0 font-bold">{formatAud(Math.round(otherCustomers * 100) / 100)}</span>
            </li>
          )}
        </ol>
        <p className="text-xs text-zinc-500">Customers are worked out from where each machine was during the month.</p>
      </div>
    </section>
  );
}
