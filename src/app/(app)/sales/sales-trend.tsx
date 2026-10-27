// Monthly sales as bars, oldest to newest. One series, so no legend: the
// heading names it. Hover or tap a bar for its exact total; a table of the
// same numbers sits underneath for anyone who prefers it.
import { formatAud } from "@/lib/au";
import type { MonthTotal } from "@/lib/sales";

const short = (month: string) =>
  new Date(`${month}T00:00:00`).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });

export function SalesTrend({ months }: { months: MonthTotal[] }) {
  if (months.length === 0) return null;
  const max = Math.max(...months.map((m) => m.total), 1);
  const latest = months[months.length - 1];

  return (
    <figure className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <figcaption className="text-sm font-bold text-zinc-600">Monthly sales, all systems</figcaption>
      <div className="relative h-40 border-b border-zinc-300">
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {months.map((m) => (
            <div key={m.month} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
              {/* Bars at least 2px tall so a quiet month is still visible. */}
              <div
                className="w-full max-w-10 rounded-t-[4px] bg-brand group-hover:bg-brand-strong group-focus:bg-brand-strong"
                style={{ height: `max(2px, ${(m.total / max) * 100}%)` }}
              />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus:block">
                {short(m.month)}: {formatAud(m.total)}
              </div>
            </div>
          ))}
        </div>
        {/* The latest month is labelled; the rest show on hover. */}
        <p className="absolute top-0 right-0 text-xs font-bold text-ink">{formatAud(latest.total)}</p>
      </div>
      <div className="flex gap-[2px] text-[10px] text-zinc-500">
        {months.map((m) => (
          <span key={m.month} className="flex-1 truncate text-center">
            {short(m.month)}
          </span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500">Show as a table</summary>
        <table className="mt-2 w-full">
          <tbody className="divide-y divide-zinc-100">
            {[...months].reverse().map((m) => (
              <tr key={m.month}>
                <td className="py-1">{short(m.month)}</td>
                <td className="py-1 text-right font-bold">{formatAud(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
