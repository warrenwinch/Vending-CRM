"use client";

import { useState, useTransition } from "react";
import { deleteVarianceRun, importVariances } from "./actions";
import { readXlsx } from "@/lib/xlsx";
import { parseVarianceFile, varianceTotals, type ParsedVariances } from "@/lib/variance-import";
import { formatDate } from "@/lib/au";

const SOMEONE_ELSE = "__someone_else__";

// Seed's report doesn't say who or when, so both are chosen here. The file is
// read and checked in the browser first, then saved in one go.
export function ImportVariances({ yesterday, today, drivers }: { yesterday: string; today: string; drivers: string[] }) {
  const [date, setDate] = useState(yesterday);
  const [picked, setPicked] = useState("");
  const [typed, setTyped] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedVariances | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();
  const driver = (picked === SOMEONE_ELSE ? typed : picked).trim();

  async function onFile(file: File | undefined) {
    setParsed(null);
    setError("");
    setDone("");
    setFileName(file?.name ?? "");
    if (!file) return;
    try {
      setParsed(parseVarianceFile(readXlsx(new Uint8Array(await file.arrayBuffer()))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This file couldn't be read.");
    }
  }

  function save() {
    if (!parsed) return;
    startTransition(async () => {
      const result = await importVariances(date, driver, parsed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError("");
      setDone(`Saved ${driver}'s run on ${formatDate(date)}: ${parsed.machines.length} machines filled, ${parsed.rows.length} coils counted.`);
      setParsed(null);
      setFileName("");
    });
  }

  const totals = parsed && varianceTotals(parsed.rows);

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink">Driver you selected in Seed</span>
          <select value={picked} onChange={(e) => setPicked(e.target.value)} className="input" required>
            <option value="">Choose the driver…</option>
            {drivers.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value={SOMEONE_ELSE}>Someone else…</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink">Date of the run</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="input" required />
        </label>
        {picked === SOMEONE_ELSE && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold text-ink">Driver&apos;s name</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={100} className="input" required />
          </label>
        )}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink">Cash Ticket Details report (.xlsx)</span>
        <input
          key={fileName ? "picked" : "empty"}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="input"
        />
      </label>

      {parsed && totals && (
        <p className="rounded-xl border-2 border-zinc-200 p-3 text-sm">
          <span className="block font-bold break-words">{fileName}</span>
          {parsed.machines.length} machines filled. {parsed.rows.length} coils counted: {totals.short} short, {totals.over} over.
        </p>
      )}
      {error && (
        <p role="alert" className="font-bold text-red-800">
          {error}
        </p>
      )}
      {done && <p aria-live="polite" className="font-bold text-leaf-deep">{done}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !parsed || driver.length < 2 || !date} className="btn-primary">
          {pending ? "Saving…" : "Import"}
        </button>
        <span className="text-sm text-zinc-500">Importing the same driver and date again replaces that run.</span>
      </div>
    </div>
  );
}

// Asks on the page itself rather than with a pop-up, which some browsers block.
export function DeleteRunButton({ date, driver }: { date: string; driver: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-sm font-medium text-red-700 underline">
        Delete
      </button>
    );
  }
  return (
    <form action={deleteVarianceRun.bind(null, date, driver)} className="flex flex-wrap items-center gap-3 text-sm">
      <span>This can&apos;t be undone.</span>
      <button type="submit" className="font-bold text-red-700 underline">
        Yes, delete this run
      </button>
      <button type="button" onClick={() => setAsking(false)} className="font-medium underline">
        Cancel
      </button>
    </form>
  );
}
