"use client";

// A running total day by day: this period (orange, solid) against the same
// period last year (blue, dashed). Hover or tap for a day's figures.
import { useState } from "react";
import { formatAud } from "@/lib/au";

const THIS_YEAR = "#f25000";
const LAST_YEAR = "#3a7cc0";
const W = 640;
const H = 220;
const PAD = { top: 16, right: 64, bottom: 24, left: 8 };

const dayAt = (start: string, i: number) => {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d;
};
const dateText = (d: Date, options: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-AU", { ...options, timeZone: "UTC" });

export function RunningChart({
  title,
  thisYear,
  lastYear,
  start,
  days,
  span,
  labels,
}: {
  title: string;
  thisYear: number[]; // running totals, first day to the latest day imported
  lastYear: number[]; // running totals for the whole of last year's period
  start: string; // the first day shown, "2026-11-01"
  days: number; // how many days the axis runs for
  span: "month" | "year";
  labels: [string, string]; // what to call this year and last year
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...thisYear, ...lastYear);
  const x = (i: number) => PAD.left + (i / Math.max(1, days - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  // A month is marked by the day number, a year by every second month's name.
  const ticks: { i: number; text: string }[] = [];
  if (span === "month") {
    for (const d of [1, 8, 15, 22, 29]) if (d <= days) ticks.push({ i: d - 1, text: String(d) });
  } else {
    let months = 0;
    for (let i = 0; i < days; i++) {
      const d = dayAt(start, i);
      if (d.getUTCDate() === 1 && months++ % 2 === 0) ticks.push({ i, text: dateText(d, { month: "short" }) });
    }
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (days - 1));
    setHover(Math.min(days - 1, Math.max(0, i)));
  }

  const last = thisYear.length - 1;
  return (
    <figure className="flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-bold text-zinc-600">{title}</span>
        <span className="flex gap-4 text-zinc-600">
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="18" y2="2" stroke={THIS_YEAR} strokeWidth="2" />
            </svg>
            {labels[0]}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="18" y2="2" stroke={LAST_YEAR} strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            {labels[1]}
          </span>
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          role="img"
          aria-label={`${title}, ${labels[0]} against ${labels[1]}`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#d4d4d8" />
          {ticks.map((t) => (
            <text key={t.i} x={x(t.i)} y={H - 6} fontSize="11" fill="#71717a" textAnchor="middle">
              {t.text}
            </text>
          ))}
          {lastYear.length > 1 && <path d={path(lastYear)} fill="none" stroke={LAST_YEAR} strokeWidth="2" strokeDasharray="5 4" />}
          {thisYear.length > 1 && <path d={path(thisYear)} fill="none" stroke={THIS_YEAR} strokeWidth="2" />}
          {/* End labels name each line, so colour isn't the only clue. */}
          {lastYear.length > 0 && (
            <text x={x(lastYear.length - 1) + 6} y={y(lastYear.at(-1)!) + 4} fontSize="11" fill="#3f3f46">
              {labels[1]}
            </text>
          )}
          {last >= 0 && (
            <>
              <circle cx={x(last)} cy={y(thisYear[last])} r="4" fill={THIS_YEAR} stroke="white" strokeWidth="2" />
              <text x={x(last) + 6} y={y(thisYear[last]) - 6} fontSize="11" fontWeight="bold" fill="#2f2e2c">
                {labels[0]}
              </text>
            </>
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="#a1a1aa" strokeDasharray="2 2" />
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-white"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > days / 2 ? "translateX(-105%)" : "translateX(5%)" }}
          >
            <p className="font-bold">{span === "month" ? `Day ${hover + 1}` : dateText(dayAt(start, hover), { day: "numeric", month: "short" })}</p>
            <p>
              {labels[0]}: {thisYear[hover] !== undefined ? formatAud(thisYear[hover]) : "not yet"}
            </p>
            <p>
              {labels[1]}: {lastYear[hover] !== undefined ? formatAud(lastYear[hover]) : "no data"}
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
