"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useState, useTransition } from "react";
import { importClients, type ImportResult } from "./actions";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  checkRow,
  findDuplicates,
  normaliseHeader,
  type RawRow,
} from "@/lib/client-import";
import { CLIENT_STATUSES } from "@/lib/client-types";
import { formatAbn } from "@/lib/au";

type Checked = { line: number; raw: RawRow; errors: string[] };

export function ImportClients() {
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
        const fields = meta.fields ?? [];
        const unknown = fields.filter((f) => f && !known.has(f));
        if (!fields.includes("company_name")) {
          setFileError("This file doesn't have a company_name column. Download the template and copy your data into it.");
          return;
        }
        if (unknown.length) {
          setFileError(`Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Please use the template's headings.`);
          return;
        }
        if (data.length === 0) {
          setFileError("The file has headings but no clients.");
          return;
        }
        if (data.length > MAX_IMPORT_ROWS) {
          setFileError(`The file has ${data.length} clients. Please import at most ${MAX_IMPORT_ROWS} at a time.`);
          return;
        }

        const raws = data as RawRow[];
        const dupes = findDuplicates(raws);
        setRows(
          raws.map((raw, i) => {
            const { errors } = checkRow(raw);
            errors.push(...(dupes.get(i) ?? []));
            return { line: i + 2, raw, errors };
          }),
        );
      },
      error: (err) => setFileError(`Could not read the file: ${err.message}`),
    });
  }

  function onImport() {
    startTransition(async () => {
      setResult(await importClients(rows.map((r) => r.raw)));
    });
  }

  // Problems found by the server (such as clients already in the system).
  const serverErrors = new Map(result.rowErrors?.map((r) => [r.row, r.errors]));
  const shown = rows.map((r) => ({ ...r, errors: serverErrors.get(r.line) ?? r.errors }));
  const problemCount = shown.filter((r) => r.errors.length).length;

  if (result.imported) {
    const count = result.imported;
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-green-50 p-4 text-green-900 dark:bg-green-950 dark:text-green-100">
          Imported {count} client{count === 1 ? "" : "s"}.
        </p>
        <div className="flex gap-3">
          <Link href="/clients" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            View clients
          </Link>
          <button type="button" onClick={() => { reset(); setFileName(""); }} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">
            Import another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>
          <a href="/client-import-template.csv" download className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Download the template
          </a>{" "}
          and open it in Excel or Google Sheets.
        </li>
        <li>Replace the two example rows with your clients, one per row. Only “company_name” is needed; leave anything you don&apos;t know blank.</li>
        <li>Save it as CSV UTF-8 and choose it below. Nothing is saved until you click Import.</li>
      </ol>

      <details className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <summary className="cursor-pointer font-medium">What goes in each column</summary>
        <dl className="mt-3 grid gap-2 text-zinc-600 dark:text-zinc-400">
          <div><dt className="inline font-medium text-zinc-900 dark:text-zinc-100">company_name: </dt><dd className="inline">Required. Must not already be one of your clients.</dd></div>
          <div><dt className="inline font-medium text-zinc-900 dark:text-zinc-100">abn: </dt><dd className="inline">Optional. 11 digits; spaces are fine.</dd></div>
          <div><dt className="inline font-medium text-zinc-900 dark:text-zinc-100">gst_registered: </dt><dd className="inline">Yes or No. Blank means No.</dd></div>
          <div><dt className="inline font-medium text-zinc-900 dark:text-zinc-100">status: </dt><dd className="inline">{CLIENT_STATUSES.map((s) => s.label).join(", ")}. Blank means Prospect.</dd></div>
          <div><dt className="inline font-medium text-zinc-900 dark:text-zinc-100">billing_contact, billing_email, billing_phone: </dt><dd className="inline">Optional.</dd></div>
        </dl>
      </details>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900"
        />
      </label>

      {fileError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          {fileError}
        </p>
      )}
      {result.error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          {result.error}
        </p>
      )}

      {shown.length > 0 && (
        <>
          <p className={`rounded-md p-3 text-sm ${problemCount ? "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-zinc-100 dark:bg-zinc-900"}`}>
            {fileName}: {shown.length} client{shown.length === 1 ? "" : "s"}.{" "}
            {problemCount
              ? `${problemCount} row${problemCount === 1 ? " has" : "s have"} a problem. Fix ${problemCount === 1 ? "it" : "them"} in the spreadsheet, save, and choose the file again.`
              : "Everything looks right."}
          </p>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-2 font-medium">Row</th>
                  <th className="p-2 font-medium">Company</th>
                  <th className="p-2 font-medium">ABN</th>
                  <th className="p-2 font-medium">GST</th>
                  <th className="p-2 font-medium">Billing contact</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {shown.map((r) => {
                  const { row } = checkRow(r.raw);
                  return (
                    <tr key={r.line} className={r.errors.length ? "bg-red-50 dark:bg-red-950/40" : undefined}>
                      <td className="p-2 align-top text-zinc-500">{r.line}</td>
                      {r.errors.length ? (
                        <td colSpan={5} className="p-2 text-red-900 dark:text-red-200">
                          <span className="font-medium">{r.raw.company_name?.trim() || "(no name)"}: </span>
                          <ul className="list-disc pl-4">
                            {r.errors.map((e) => <li key={e}>{e}</li>)}
                          </ul>
                        </td>
                      ) : (
                        <>
                          <td className="p-2 font-medium">{row?.company_name}</td>
                          <td className="p-2 whitespace-nowrap">{formatAbn(row?.abn ?? null)}</td>
                          <td className="p-2">{row?.gst_registered ? "Yes" : "No"}</td>
                          <td className="p-2">
                            {[row?.billing_contact, row?.billing_email, row?.billing_phone].filter(Boolean).join(" · ")}
                          </td>
                          <td className="p-2">{CLIENT_STATUSES.find((s) => s.value === row?.status)?.label}</td>
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
            className="self-start rounded-md bg-zinc-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Importing…" : `Import ${shown.length} client${shown.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
