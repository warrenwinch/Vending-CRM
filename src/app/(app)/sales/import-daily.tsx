"use client";

import Papa from "papaparse";
import { useState, useTransition } from "react";
import { importDailySales, type SalesImportResult } from "./actions";
import { readXlsx } from "@/lib/xlsx";
import { parseDailyHistory, parseSalesFile, sourceLabel, type DailyTotal } from "@/lib/sales-import";
import { formatAud, formatDate } from "@/lib/au";

// One picked file: either one system's report for one day (Excel), or a
// history file of many days (CSV).
type Picked = { name: string; error?: string; excel?: Omit<DailyTotal, "day"> & { fileDay: string | null }; history?: DailyTotal[] };

const sum = (n: number[]) => Math.round(n.reduce((a, b) => a + b, 0) * 100) / 100;

// Each morning: yesterday's three reports. The day comes from the box
// below, except Nayax files, which say their own date.
export function ImportDaily({ yesterday }: { yesterday: string }) {
  const [day, setDay] = useState(yesterday);
  const [files, setFiles] = useState<Picked[]>([]);
  const [result, setResult] = useState<SalesImportResult>({});
  const [pending, startTransition] = useTransition();

  async function onFiles(list: FileList | null) {
    setResult({});
    const picked: Picked[] = [];
    for (const file of Array.from(list ?? [])) {
      try {
        if (/\.csv$/i.test(file.name)) {
          const { data } = Papa.parse<Record<string, string>>(await file.text(), {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: (h) => h.trim().toLowerCase(),
          });
          picked.push({ name: file.name, history: parseDailyHistory(data) });
        } else {
          const p = parseSalesFile(readXlsx(new Uint8Array(await file.arrayBuffer())));
          picked.push({
            name: file.name,
            excel: { source: p.source, units: p.rows.reduce((t, r) => t + r.units, 0), amount: p.total, fileDay: p.day },
          });
        }
      } catch (e) {
        picked.push({ name: file.name, error: e instanceof Error ? e.message : "This file couldn't be read." });
      }
    }
    setFiles(picked);
  }

  const rows: DailyTotal[] = files.flatMap((f) =>
    f.history ?? (f.excel ? [{ source: f.excel.source, day: f.excel.fileDay ?? day, units: f.excel.units, amount: f.excel.amount }] : []),
  );

  function save() {
    startTransition(async () => setResult(await importDailySales(rows)));
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <label className="flex max-w-xs flex-col gap-1">
        <span className="text-sm font-bold text-ink">Day the sales are for</span>
        <input type="date" value={day} max={yesterday} onChange={(e) => setDay(e.target.value)} className="input" required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink">That day&apos;s reports (.xlsx), or a history file (.csv)</span>
        <input
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="input"
        />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {files.map((f) => (
            <li key={f.name} className="rounded-xl border-2 border-zinc-200 p-3">
              <p className="font-bold break-words">{f.name}</p>
              {f.error && <p className="text-red-800">{f.error}</p>}
              {f.excel && (
                <p>
                  {sourceLabel(f.excel.source)}, {formatDate(f.excel.fileDay ?? day)}: {formatAud(f.excel.amount)}
                  {f.excel.fileDay && f.excel.fileDay !== day && (
                    <span className="block text-zinc-500">The day comes from the file itself.</span>
                  )}
                </p>
              )}
              {f.history && (
                <p>
                  History: {f.history.length} daily totals, {formatDate(f.history[0]?.day ?? null)} to{" "}
                  {formatDate(f.history.at(-1)?.day ?? null)}, {formatAud(sum(f.history.map((h) => h.amount)))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {result.error && <p className="font-bold text-red-800">{result.error}</p>}
      {result.saved !== undefined && !result.error && (
        <p className="font-bold text-leaf-deep">
          Saved {result.saved} daily total{result.saved === 1 ? "" : "s"} ({formatAud(result.total ?? 0)}).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending || rows.length === 0 || !day} className="btn-primary">
          {pending ? "Saving…" : "Import daily sales"}
        </button>
        <span className="text-sm text-zinc-500">A day imported again replaces it.</span>
      </div>
      <details className="text-sm text-zinc-600">
        <summary className="cursor-pointer font-bold">How to export yesterday&apos;s reports</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Seed – Vending:</strong> Report Writer, Sales (Vending Realtime Sales) report for Asset, From and To both
            yesterday, Export to Excel.
          </li>
          <li>
            <strong>Seed – Markets:</strong> the same with Market Sales.
          </li>
          <li>
            <strong>Nayax:</strong> Sales Summary, Time Interval Yesterday, View Report, Sales By Machine tab, Export to Excel.
          </li>
        </ul>
      </details>
    </div>
  );
}
