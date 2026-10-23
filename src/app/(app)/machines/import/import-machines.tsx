"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useState, useTransition } from "react";
import { importMachines, type ImportResult } from "./actions";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  checkRow,
  findDuplicateSerials,
  normaliseHeader,
  type RawRow,
} from "@/lib/machine-import";
import { MACHINE_STATUSES, MACHINE_TYPES } from "@/lib/machine-types";
import { formatAud, formatDate } from "@/lib/au";

type Checked = { line: number; raw: RawRow; errors: string[] };

export function ImportMachines({ allowCost }: { allowCost: boolean }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Checked[]>([]);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<ImportResult>({});
  const [pending, startTransition] = useTransition();

  function reset() {
    setRows([]);
    setFileError("");
    setResult({});
  }

  // Reads the file in the browser and checks every row before anything is sent.
  function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normaliseHeader,
      complete: ({ data, meta }) => {
        const known = new Set<string>(IMPORT_COLUMNS);
        const unknown = (meta.fields ?? []).filter((f) => f && !known.has(f));
        if (!(meta.fields ?? []).some((f) => known.has(f))) {
          setFileError("This file doesn't have the template's column headings. Download the template and copy your data into it.");
          return;
        }
        if (unknown.length) {
          setFileError(`Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Please use the template's headings.`);
          return;
        }
        if (data.length === 0) {
          setFileError("The file has headings but no machines.");
          return;
        }
        if (data.length > MAX_IMPORT_ROWS) {
          setFileError(`The file has ${data.length} machines. Please import at most ${MAX_IMPORT_ROWS} at a time.`);
          return;
        }

        const raws = data as RawRow[];
        const dupes = findDuplicateSerials(raws);
        setRows(
          raws.map((raw, i) => {
            const { errors } = checkRow(raw, { allowCost });
            if (dupes.has(i)) errors.push(dupes.get(i)!);
            return { line: i + 2, raw, errors };
          }),
        );
      },
      error: (err) => setFileError(`Could not read the file: ${err.message}`),
    });
  }

  function onImport() {
    startTransition(async () => {
      setResult(await importMachines(rows.map((r) => r.raw)));
    });
  }

  // Problems found by the server (such as serial numbers already in the system).
  const serverErrors = new Map(result.rowErrors?.map((r) => [r.row, r.errors]));
  const shown = rows.map((r) => ({ ...r, errors: serverErrors.get(r.line) ?? r.errors }));
  const problemCount = shown.filter((r) => r.errors.length).length;

  if (result.imported) {
    const { count, first, last } = result.imported;
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-green-50 p-4 text-green-900">
          Imported {count} machine{count === 1 ? "" : "s"}: {first === last ? first : `${first} to ${last}`}.
        </p>
        <div className="flex gap-3">
          <Link href="/machines" className="btn-primary">
            View machines
          </Link>
          <button type="button" onClick={() => { reset(); setFileName(""); }} className="btn-secondary">
            Import another file
          </button>
        </div>
      </div>
    );
  }

  const label = (list: { value: string; label: string }[], text: string | undefined) =>
    list.find((o) => o.value === text)?.label ?? text;

  return (
    <div className="flex flex-col gap-6">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600">
        <li>
          <a href="/machine-import-template.csv" download className="font-bold text-brand-deep underline">
            Download the template
          </a>{" "}
          and open it in Excel or Google Sheets.
        </li>
        <li>Replace the two example rows with your machines, one per row. Only “type” is needed; leave anything you don&apos;t know blank.</li>
        <li>Save it as CSV and choose it below. Nothing is saved until you click Import.</li>
      </ol>

      <details className="rounded-2xl border-2 border-zinc-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">What goes in each column</summary>
        <dl className="mt-3 grid gap-2 text-zinc-600">
          <div><dt className="inline font-medium text-ink">type: </dt><dd className="inline">{MACHINE_TYPES.map((t) => t.label).join(", ")}. Blank means Snack.</dd></div>
          <div><dt className="inline font-medium text-ink">status: </dt><dd className="inline">{MACHINE_STATUSES.filter((s) => s.value !== "installed").map((s) => s.label).join(", ")}. Blank means In storage. Machines become Installed when you place them at a location.</dd></div>
          <div><dt className="inline font-medium text-ink">purchase_date: </dt><dd className="inline">DD/MM/YYYY, for example 23/10/2026.</dd></div>
          <div><dt className="inline font-medium text-ink">purchase_cost: </dt><dd className="inline">{allowCost ? "Dollars, for example 4500 or 4,500.00." : "Left out for your role; only Administrators and Managers can set it."}</dd></div>
          <div><dt className="inline font-medium text-ink">machine number: </dt><dd className="inline">Not in the file. Each machine gets the next VM number automatically.</dd></div>
        </dl>
      </details>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-brand-strong file:px-5 file:py-3 file:text-base file:font-bold file:text-white"
        />
      </label>

      {fileError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">
          {fileError}
        </p>
      )}
      {result.error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">
          {result.error}
        </p>
      )}

      {shown.length > 0 && (
        <>
          <p className={`rounded-md p-3 text-sm ${problemCount ? "bg-red-50 text-red-900" : "bg-zinc-100"}`}>
            {fileName}: {shown.length} machine{shown.length === 1 ? "" : "s"}.{" "}
            {problemCount
              ? `${problemCount} row${problemCount === 1 ? " has" : "s have"} a problem. Fix ${problemCount === 1 ? "it" : "them"} in the spreadsheet, save, and choose the file again.`
              : "Everything looks right."}
          </p>

          <div className="overflow-x-auto rounded-2xl border-2 border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="p-2 font-medium">Row</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Make / model</th>
                  <th className="p-2 font-medium">Serial</th>
                  <th className="p-2 font-medium">Bought</th>
                  {allowCost && <th className="p-2 font-medium">Cost</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {shown.map((r) => {
                  const { row } = checkRow(r.raw, { allowCost });
                  return (
                    <tr key={r.line} className={r.errors.length ? "bg-red-50" : undefined}>
                      <td className="p-2 align-top text-zinc-500">{r.line}</td>
                      {r.errors.length ? (
                        <td colSpan={allowCost ? 6 : 5} className="p-2 text-red-900">
                          <ul className="list-disc pl-4">
                            {r.errors.map((e) => <li key={e}>{e}</li>)}
                          </ul>
                        </td>
                      ) : (
                        <>
                          <td className="p-2">{label(MACHINE_TYPES, row?.type)}</td>
                          <td className="p-2">{label(MACHINE_STATUSES, row?.status)}</td>
                          <td className="p-2">{[row?.manufacturer, row?.model].filter(Boolean).join(" ")}</td>
                          <td className="p-2">{row?.serial_number}</td>
                          <td className="p-2 whitespace-nowrap">{formatDate(row?.purchase_date ?? null)}</td>
                          {allowCost && (
                            <td className="p-2 whitespace-nowrap">
                              {row?.purchase_cost != null ? formatAud(row.purchase_cost) : ""}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={onImport}
            disabled={pending || problemCount > 0}
            className="btn-primary self-start"
          >
            {pending ? "Importing…" : `Import ${shown.length} machine${shown.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
