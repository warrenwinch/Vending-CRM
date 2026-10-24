"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { importLocations, type ImportResult } from "./actions";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  checkRow,
  clientKey,
  findDuplicates,
  normaliseHeader,
  type RawRow,
} from "@/lib/location-import";
import { COMMISSION_TYPES, LOCATION_STATUSES, LOCATION_TYPES, labelOf } from "@/lib/location-types";
import { formatAud } from "@/lib/au";

type Checked = { line: number; raw: RawRow; errors: string[] };

export function ImportLocations({ clients }: { clients: { value: string; label: string }[] }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Checked[]>([]);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<ImportResult>({});
  const [pending, startTransition] = useTransition();

  // Client names to ids, matched without caring about capitals or extra spaces.
  const clientMap = useMemo(() => new Map(clients.map((c) => [clientKey(c.label), c.value])), [clients]);
  const clientName = useMemo(() => new Map(clients.map((c) => [c.value, c.label])), [clients]);

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
        if (!fields.includes("client_name") || !fields.includes("site_name")) {
          setFileError("This file needs client_name and site_name columns. Download the template and copy your data into it.");
          return;
        }
        if (unknown.length) {
          setFileError(`Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Please use the template's headings.`);
          return;
        }
        if (data.length === 0) {
          setFileError("The file has headings but no locations.");
          return;
        }
        if (data.length > MAX_IMPORT_ROWS) {
          setFileError(`The file has ${data.length} locations. Please import at most ${MAX_IMPORT_ROWS} at a time.`);
          return;
        }

        const raws = data as RawRow[];
        const dupes = findDuplicates(raws);
        setRows(
          raws.map((raw, i) => {
            const { errors } = checkRow(raw, clientMap);
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
      setResult(await importLocations(rows.map((r) => r.raw)));
    });
  }

  // Problems found by the server (such as sites that already exist).
  const serverErrors = new Map(result.rowErrors?.map((r) => [r.row, r.errors]));
  const shown = rows.map((r) => ({ ...r, errors: serverErrors.get(r.line) ?? r.errors }));
  const problemCount = shown.filter((r) => r.errors.length).length;

  if (result.imported) {
    const count = result.imported;
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl border-l-8 border-leaf bg-leaf-soft p-4 font-medium text-leaf-deep">
          Imported {count} location{count === 1 ? "" : "s"}.
        </p>
        <div className="flex gap-3">
          <Link href="/locations" className="btn-primary">
            View locations
          </Link>
          <button type="button" onClick={() => { reset(); setFileName(""); }} className="btn-secondary">
            Import another file
          </button>
        </div>
      </div>
    );
  }

  const commissionText = (type: string | undefined, rate: number | null | undefined) =>
    type === "percentage" ? `${rate}%` : type === "fixed_monthly" && rate != null ? `${formatAud(rate)}/month` : "None";

  return (
    <div className="flex flex-col gap-6">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600">
        <li>
          <a href="/location-import-template.csv" download className="font-bold text-brand-deep underline">
            Download the template
          </a>{" "}
          and open it in Excel or Google Sheets.
        </li>
        <li>
          Replace the two example rows with your sites, one per row. Each row needs the <b>client_name</b> (exactly as it
          is in Clients) and a <b>site_name</b>; leave anything you don&apos;t know blank.
        </li>
        <li>Save it as CSV UTF-8 and choose it below. Nothing is saved until you click Import.</li>
      </ol>

      <details className="rounded-2xl bg-white p-4 text-sm ring-2 ring-zinc-200">
        <summary className="cursor-pointer font-bold">What goes in each column</summary>
        <dl className="mt-3 grid gap-2 text-zinc-600">
          <div><dt className="inline font-bold text-ink">client_name: </dt><dd className="inline">Required. Must match one of your clients ({clients.length} so far). Capitals don&apos;t matter.</dd></div>
          <div><dt className="inline font-bold text-ink">site_name: </dt><dd className="inline">Required, for example &ldquo;ABS House&rdquo;.</dd></div>
          <div><dt className="inline font-bold text-ink">type: </dt><dd className="inline">{LOCATION_TYPES.map((t) => t.label).join(", ")}. Blank means Other.</dd></div>
          <div><dt className="inline font-bold text-ink">status: </dt><dd className="inline">{LOCATION_STATUSES.map((s) => s.label).join(", ")}. Blank means Prospect.</dd></div>
          <div><dt className="inline font-bold text-ink">commission_type: </dt><dd className="inline">None, Percentage or Fixed monthly. Blank means None.</dd></div>
          <div><dt className="inline font-bold text-ink">commission_rate: </dt><dd className="inline">For Percentage, the % (e.g. 10). For Fixed monthly, dollars per month (e.g. 150).</dd></div>
          <div><dt className="inline font-bold text-ink">address, placement_notes, access_instructions, operating_hours, foot_traffic: </dt><dd className="inline">Optional.</dd></div>
        </dl>
      </details>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-bold">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-brand-strong file:px-5 file:py-3 file:text-base file:font-bold file:text-white"
        />
      </label>

      {(fileError || result.error) && (
        <p role="alert" className="rounded-xl border-l-8 border-red-600 bg-red-50 p-4 font-medium text-red-900">
          {fileError || result.error}
        </p>
      )}

      {shown.length > 0 && (
        <>
          <p className={`rounded-xl p-3 text-sm ${problemCount ? "bg-red-50 text-red-900" : "bg-white ring-2 ring-zinc-200"}`}>
            {fileName}: {shown.length} location{shown.length === 1 ? "" : "s"}.{" "}
            {problemCount
              ? `${problemCount} row${problemCount === 1 ? " has" : "s have"} a problem. Fix ${problemCount === 1 ? "it" : "them"} in the spreadsheet, save, and choose the file again.`
              : "Everything looks right."}
          </p>

          <div className="overflow-x-auto rounded-2xl border-2 border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="p-2 font-medium">Row</th>
                  <th className="p-2 font-medium">Client</th>
                  <th className="p-2 font-medium">Site</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {shown.map((r) => {
                  const { row } = checkRow(r.raw, clientMap);
                  return (
                    <tr key={r.line} className={r.errors.length ? "bg-red-50" : undefined}>
                      <td className="p-2 align-top text-zinc-500">{r.line}</td>
                      {r.errors.length ? (
                        <td colSpan={5} className="p-2 text-red-900">
                          <span className="font-medium">{r.raw.site_name?.trim() || "(no site name)"}: </span>
                          <ul className="list-disc pl-4">
                            {r.errors.map((e) => <li key={e}>{e}</li>)}
                          </ul>
                        </td>
                      ) : (
                        <>
                          <td className="p-2">{row && clientName.get(row.client_id)}</td>
                          <td className="p-2 font-medium">{row?.site_name}</td>
                          <td className="p-2">{row && labelOf(LOCATION_TYPES, row.type)}</td>
                          <td className="p-2">{row && labelOf(LOCATION_STATUSES, row.status)}</td>
                          <td className="p-2 whitespace-nowrap">
                            {row && (row.commission_type === "none" ? labelOf(COMMISSION_TYPES, "none") : commissionText(row.commission_type, row.commission_rate))}
                          </td>
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
            {pending ? "Importing…" : `Import ${shown.length} location${shown.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
