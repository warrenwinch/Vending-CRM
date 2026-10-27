"use client";

import { useState, useTransition } from "react";
import { importSales, type SalesImportResult } from "./actions";
import { readXlsx } from "@/lib/xlsx";
import { SALES_SOURCES, parseSalesFile, sourceLabel, type ParsedSales } from "@/lib/sales-import";
import { formatAud } from "@/lib/au";

type Picked = { name: string; parsed?: ParsedSales; error?: string; result?: SalesImportResult };

const monthLabel = (month: string) =>
  new Date(`${month}T00:00:00`).toLocaleDateString("en-AU", { month: "long", year: "numeric" });

// Choose the month and up to three exported reports; each is read and
// checked here first, then saved one system at a time.
export function ImportSales({ lastMonth }: { lastMonth: string }) {
  const [month, setMonth] = useState(lastMonth.slice(0, 7));
  const [files, setFiles] = useState<Picked[]>([]);
  const [pending, startTransition] = useTransition();

  async function onFiles(list: FileList | null) {
    const picked: Picked[] = [];
    for (const file of Array.from(list ?? [])) {
      try {
        const parsed = parseSalesFile(readXlsx(new Uint8Array(await file.arrayBuffer())));
        picked.push({ name: file.name, parsed });
      } catch (e) {
        picked.push({ name: file.name, error: e instanceof Error ? e.message : "This file couldn't be read." });
      }
    }
    setFiles(picked);
    // Nayax says which month it covers: use that if nothing else was chosen.
    const fromFile = picked.find((p) => p.parsed?.month)?.parsed?.month;
    if (fromFile) setMonth(fromFile.slice(0, 7));
  }

  const ready = files.filter((f) => f.parsed && !f.result?.saved);
  const sameSystemTwice = new Set(ready.map((f) => f.parsed!.source)).size !== ready.length;
  const monthStart = `${month}-01`;

  function save() {
    startTransition(async () => {
      const next = [...files];
      for (const [i, f] of next.entries()) {
        if (!f.parsed || f.result?.saved) continue;
        next[i] = { ...f, result: await importSales(f.parsed.source, monthStart, f.parsed.rows) };
        setFiles([...next]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <label className="flex max-w-xs flex-col gap-1">
        <span className="text-sm font-bold text-ink">Month the sales are for</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink">Exported reports (.xlsx), up to three at once</span>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="input"
        />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.name} className="rounded-xl border-2 border-zinc-200 p-3 text-sm">
              <p className="font-bold break-words">{f.name}</p>
              {f.error && <p className="text-red-800">{f.error}</p>}
              {f.parsed && (
                <p>
                  {sourceLabel(f.parsed.source)}: {f.parsed.rows.length} machines, {formatAud(f.parsed.total)}
                  {f.parsed.month && f.parsed.month !== monthStart && (
                    <span className="block font-bold text-amber-800">
                      This file is for {monthLabel(f.parsed.month)}, not {monthLabel(monthStart)}. Check the month above.
                    </span>
                  )}
                </p>
              )}
              {f.result?.error && <p className="font-bold text-red-800">{f.result.error}</p>}
              {f.result?.saved !== undefined && !f.result.error && (
                <p className="font-bold text-leaf-deep">
                  Saved {f.result.saved} machines for {monthLabel(monthStart)}
                  {f.result.matched ? `; ${f.result.matched} newly matched to machines` : ""}.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {sameSystemTwice && (
        <p className="font-bold text-red-800">Two files are the same report. Choose one file per system.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || ready.length === 0 || sameSystemTwice || !month}
          className="btn-primary"
        >
          {pending ? "Saving…" : `Import ${ready.length || ""} for ${month ? monthLabel(monthStart) : "…"}`}
        </button>
        <span className="text-sm text-zinc-500">Importing a month again replaces it, so nothing is counted twice.</span>
      </div>

      <details className="text-sm text-zinc-600">
        <summary className="cursor-pointer font-bold">How to export each report</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {SALES_SOURCES.map((s) => (
            <li key={s.value}>
              <strong>{s.label}:</strong> {s.howTo}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
