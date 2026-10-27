import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listIgnored, listImportedDays, listImportedMonths, listUnmatched } from "@/lib/sales";
import { listMachines } from "@/lib/machines";
import { addDays, sourceLabel } from "@/lib/sales-import";
import { formatAud, formatDate, lastMonthInSydney, todayInSydney } from "@/lib/au";
import { ImportSales } from "./import-sales";
import { ImportDaily } from "./import-daily";
import { linkSale, unignoreSale } from "./actions";

export default function SalesPage() {
  return (
    <>
      <div>
        <h1 className="page-title">Sales</h1>
        <p className="mt-1 text-zinc-600">
          Each month, export last month&apos;s sales from Seed (Vending and Markets) and Nayax, and import them here.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Sales />
      </Suspense>
    </>
  );
}

const monthLabel = (month: string) =>
  new Date(`${month}T00:00:00`).toLocaleDateString("en-AU", { month: "long", year: "numeric" });

async function Sales() {
  await requireRole(OFFICE_ROLES);
  const [months, unmatched, ignored, machines, days] = await Promise.all([
    listImportedMonths(),
    listUnmatched(),
    listIgnored(),
    listMachines({}),
    listImportedDays(),
  ]);
  const yesterday = addDays(todayInSydney(), -1);
  const machineOptions = [...machines]
    .sort((a, b) => a.machine_number.localeCompare(b.machine_number, undefined, { numeric: true }))
    .map((m) => ({
      value: m.id,
      label: [m.machine_number, m.site_name ?? "In storage", m.serial_number && `S/N ${m.serial_number}`].filter(Boolean).join(" · "),
    }));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="section-title">Each morning: yesterday</h2>
        <p className="text-sm text-zinc-600">
          For Yesterday, Week to date and the month-to-date chart on Home.
        </p>
        <ImportDaily yesterday={yesterday} />
        {days.length > 0 && (
          <p className="text-sm text-zinc-600">
            Latest days imported:{" "}
            {[...new Map(days.map((d) => [d.day, 0])).keys()].slice(0, 7).map((d, i) => (
              <span key={d}>
                {i > 0 && ", "}
                {formatDate(d)} ({days.filter((x) => x.day === d).length}/3 systems)
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Each month: last month by machine</h2>
        <ImportSales lastMonth={lastMonthInSydney()[0]} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Needs matching ({unmatched.length})</h2>
        {unmatched.length === 0 ? (
          <p className="text-sm text-zinc-500">Every sales ID is matched to a machine (or set to not track).</p>
        ) : (
          <>
            <p className="text-sm text-zinc-600">
              These IDs from Seed or Nayax didn&apos;t match a machine by themselves. Choose the machine once and the CRM
              remembers it for every month. Their sales still count in the totals meanwhile.
            </p>
            <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
              {unmatched.map((u) => (
                <li key={`${u.source}|${u.external_id}`} className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="font-bold">{u.external_id}</span>{" "}
                      <span className="text-sm text-zinc-500">
                        {sourceLabel(u.source)}
                        {u.external_name && ` · ${u.external_name}`}
                      </span>
                    </p>
                    <span className="text-sm font-bold">{formatAud(u.total)}</span>
                  </div>
                  <form action={linkSale.bind(null, u.source, u.external_id)} className="flex flex-wrap gap-2">
                    <select name="machine_id" required defaultValue="" aria-label={`Machine for ${u.external_id}`} className="input min-w-0 flex-1">
                      <option value="" disabled>
                        Choose the machine…
                      </option>
                      <option value="none">Don&apos;t track this one</option>
                      {machineOptions.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-secondary">
                      Save
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
        {ignored.length > 0 && (
          <details className="text-sm text-zinc-600">
            <summary className="cursor-pointer font-bold">Not tracked ({ignored.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {ignored.map((i) => (
                <li key={`${i.source}|${i.external_id}`} className="flex flex-wrap items-center gap-2">
                  {i.external_id} <span className="text-zinc-400">({sourceLabel(i.source)})</span>
                  <form action={unignoreSale.bind(null, i.source, i.external_id)}>
                    <button type="submit" className="underline">
                      Match it after all
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Imported</h2>
        {months.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing imported yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="p-3">Month</th>
                  <th className="p-3">System</th>
                  <th className="p-3 text-right">Machines</th>
                  <th className="p-3 text-right">Matched</th>
                  <th className="p-3 text-right">Units</th>
                  <th className="p-3 text-right">Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {months.map((m) => (
                  <tr key={`${m.month}|${m.source}`}>
                    <td className="p-3 whitespace-nowrap">{monthLabel(m.month)}</td>
                    <td className="p-3 whitespace-nowrap">{sourceLabel(m.source)}</td>
                    <td className="p-3 text-right">{m.machines}</td>
                    <td className={`p-3 text-right ${m.matched < m.machines ? "font-bold text-amber-800" : ""}`}>{m.matched}</td>
                    <td className="p-3 text-right">{m.units.toLocaleString("en-AU")}</td>
                    <td className="p-3 text-right font-bold">{formatAud(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-zinc-500">
          Sales on the Home page come next.{" "}
          <Link href="/machines" className="underline">
            Add any missing machines
          </Link>{" "}
          first if a sales ID has no machine in the CRM yet.
        </p>
      </section>
    </>
  );
}
