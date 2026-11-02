// Yesterday, Week to date and Month to date on Home (Administrators and
// Managers only), from the daily totals imported each morning.
import Link from "next/link";
import { formatAud, formatDate } from "@/lib/au";
import { dailyTotals, latestDailyDay } from "@/lib/sales";
import { addDays } from "@/lib/sales-import";
import { RunningChart } from "./running-chart";

const total = (byDay: Map<string, number>, from: string, to: string) => {
  let t = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) t += byDay.get(d) ?? 0;
  return Math.round(t * 100) / 100;
};

function Tile({
  title,
  value,
  before,
  beforeLabel,
  note,
}: {
  title: string;
  value: number;
  before: number | null;
  beforeLabel: string;
  note?: string;
}) {
  const pct = before ? ((value - before) / before) * 100 : null;
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <p className="text-sm font-bold text-zinc-600">{title}</p>
      <p className="font-display text-3xl font-extrabold">{formatAud(value)}</p>
      <p className="text-sm text-zinc-500">
        {pct !== null && (
          <span className={`font-bold ${pct >= 0 ? "text-leaf-deep" : "text-red-700"}`}>
            {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%{" "}
          </span>
        )}
        {before === null ? beforeLabel : `${beforeLabel} ${formatAud(before)}`}
      </p>
      {note && <p className="text-sm text-zinc-500">{note}</p>}
    </div>
  );
}

export async function DailySummary() {
  const latest = await latestDailyDay();
  if (!latest) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-500">
        No daily sales yet.{" "}
        <Link href="/sales" className="font-medium underline">
          Import yesterday&apos;s reports
        </Link>{" "}
        to see Yesterday, Week to date and Month to date here.
      </p>
    );
  }

  const [y, m, d] = latest.split("-").map(Number);
  const monday = addDays(latest, -((new Date(`${latest}T00:00:00Z`).getUTCDay() + 6) % 7));
  const monthStart = `${latest.slice(0, 8)}01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lyStart = `${y - 1}-${String(m).padStart(2, "0")}-01`;
  const lyDays = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  const lyEnd = `${lyStart.slice(0, 8)}${String(lyDays).padStart(2, "0")}`;

  const from = [monthStart, addDays(monday, -7), addDays(latest, -7)].sort()[0];
  // Australian financial year: 1 July to 30 June. Last year runs to the same date.
  const fyStartYear = m >= 7 ? y : y - 1;
  const fyStart = `${fyStartYear}-07-01`;
  const lyFyStart = `${fyStartYear - 1}-07-01`;
  const lyFyEnd = `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, lyDays)).padStart(2, "0")}`;
  const [recent, lastYear, fy, lastFy, fyNoMarkets, lastFyNoMarkets] = await Promise.all([
    dailyTotals(from, latest),
    dailyTotals(lyStart, lyEnd),
    dailyTotals(fyStart, latest),
    dailyTotals(lyFyStart, `${fyStartYear}-06-30`),
    dailyTotals(fyStart, latest, "seed_market"),
    dailyTotals(lyFyStart, lyFyEnd, "seed_market"),
  ]);
  const fyToDate = total(fy, fyStart, latest);
  // Only compare when last year's figures go back to its start, or it would look like a big rise.
  const lastFyToDate = lastFy.has(lyFyStart) ? total(lastFy, lyFyStart, lyFyEnd) : null;

  // Markets are new, so also show the year without them, like for like.
  const noMarkets = total(fyNoMarkets, fyStart, latest);
  const lastNoMarkets = lastFyToDate === null ? 0 : total(lastFyNoMarkets, lyFyStart, lyFyEnd);
  const noMarketsChange = lastNoMarkets ? ((noMarkets - lastNoMarkets) / lastNoMarkets) * 100 : null;
  const noMarketsNote =
    noMarkets === fyToDate
      ? undefined
      : `Without Markets: ${formatAud(noMarkets)}${
          noMarketsChange === null ? "" : ` (${noMarketsChange >= 0 ? "▲" : "▼"} ${Math.abs(noMarketsChange).toFixed(1)}%)`
        }`;

  const yesterday = total(recent, latest, latest);
  const sameDayLastWeek = total(recent, addDays(latest, -7), addDays(latest, -7));
  const wtd = total(recent, monday, latest);
  const lastWeekToDate = total(recent, addDays(monday, -7), addDays(latest, -7));
  const mtd = total(recent, monthStart, latest);
  const lyToSameDay = total(lastYear, lyStart, `${lyStart.slice(0, 8)}${String(Math.min(d, lyDays)).padStart(2, "0")}`);

  const running = (byDay: Map<string, number>, start: string, days: number) => {
    let t = 0;
    return Array.from({ length: days }, (_, i) => (t = Math.round((t + (byDay.get(addDays(start, i)) ?? 0)) * 100) / 100));
  };
  const fyDays = (Date.UTC(fyStartYear + 1, 5, 30) - Date.UTC(fyStartYear, 6, 1)) / 86400000 + 1;
  const fyDaysSoFar = (Date.UTC(y, m - 1, d) - Date.UTC(fyStartYear, 6, 1)) / 86400000 + 1;
  const fyLabel = (start: number) => `${start}/${String(start + 1).slice(2)}`;
  const monthName = new Date(`${monthStart}T00:00:00`).toLocaleDateString("en-AU", { month: "long" });
  const weekday = new Date(`${latest}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long" });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title={`Yesterday (${weekday} ${formatDate(latest)})`} value={yesterday} before={sameDayLastWeek} beforeLabel={`last ${weekday}`} />
        <Tile title="Week to date" value={wtd} before={lastWeekToDate} beforeLabel="same days last week" />
        <Tile title={`${monthName} to date`} value={mtd} before={lyToSameDay} beforeLabel={`${monthName} ${y - 1} to day ${d}`} />
        <Tile
          title={`Year to date (from ${formatDate(fyStart)})`}
          value={fyToDate}
          before={lastFyToDate}
          beforeLabel={lastFyToDate === null ? "Last year's history isn't loaded yet" : "same dates last year"}
          note={noMarketsNote}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <RunningChart
          title={`${monthName} to date, running total`}
          thisYear={running(recent, monthStart, d)}
          lastYear={lastYear.size ? running(lastYear, lyStart, lyDays) : []}
          start={monthStart}
          days={daysInMonth}
          span="month"
          labels={[String(y), String(y - 1)]}
        />
        <RunningChart
          title="Year to date, running total from 1 July"
          thisYear={running(fy, fyStart, fyDaysSoFar)}
          lastYear={lastFyToDate === null ? [] : running(lastFy, lyFyStart, fyDays)}
          start={fyStart}
          days={fyDays}
          span="year"
          labels={[fyLabel(fyStartYear), fyLabel(fyStartYear - 1)]}
        />
      </div>
    </div>
  );
}
