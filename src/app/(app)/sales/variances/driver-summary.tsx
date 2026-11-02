// The By driver table on Home (Administrators and Managers only). Stays hidden
// until a run in these periods has been imported.
import Link from "next/link";
import { todayInSydney } from "@/lib/au";
import { listRunMachines, listVariances } from "@/lib/variances";
import { driverLines, PeriodTable, statsFor, variancePeriods } from "./period-table";

export async function DriverSummary() {
  const periods = variancePeriods(todayInSydney());
  const from = periods.map((p) => p.from).sort()[0];
  const to = periods[0].to;
  const [rows, machines] = await Promise.all([listVariances(from, to), listRunMachines(from, to)]);
  const lines = driverLines(rows, machines, periods);
  if (lines.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Stock variances by driver</h2>
        <Link href="/sales/variances" className="btn-small">
          See all
        </Link>
      </div>
      <PeriodTable first="Driver" periods={periods} lines={lines} total={periods.map((p) => statsFor(rows, machines, p))} />
    </section>
  );
}
