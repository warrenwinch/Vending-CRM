"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useState, useTransition } from "react";
import { importCommission, type CommissionImportResult } from "./actions";
import { MAX_COMMISSION_ROWS, nameKey, parseCommissionFile, type CommissionRow } from "@/lib/commission-import";
import { PAYMENT_METHODS } from "@/lib/commission-types";
import { formatAud, formatDate } from "@/lib/au";

type Option = { id: string; name: string };
type Site = Option & { client_id: string; lost: boolean };
type Choice = { client_id: string; location_id: string; skip: boolean };

// Which customer and site each Seed name went to last time, kept in this
// browser so the next quarter's file fills itself in.
const MEMORY = "commission-import-choices";
function remembered(): Record<string, { client_id: string; location_id: string }> {
  try {
    return JSON.parse(localStorage.getItem(MEMORY) ?? "{}");
  } catch {
    return {};
  }
}
function remember(entries: Record<string, { client_id: string; location_id: string }>) {
  try {
    localStorage.setItem(MEMORY, JSON.stringify({ ...remembered(), ...entries }));
  } catch {
    // Not remembering is fine.
  }
}

export function ImportCommission({ clients, sites, recorded }: { clients: Option[]; sites: Site[]; recorded: string[] }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<CommissionImportResult>({});
  const [pending, startTransition] = useTransition();

  const done = new Set(recorded);
  const byName = new Map(clients.map((c) => [nameKey(c.name), c.id]));
  const sitesOf = (clientId: string) => {
    const all = sites.filter((s) => s.client_id === clientId);
    const open = all.filter((s) => !s.lost);
    return open.length ? open : all;
  };
  const isDone = (r: CommissionRow, c: Choice) => !!c.client_id && done.has(`${c.client_id}|${r.period_start}|${r.period_end}`);

  // Picks the customer by name and the site when there's only one (or it was chosen before).
  function guess(r: CommissionRow, memory: ReturnType<typeof remembered>): Choice {
    const key = nameKey(r.customer);
    const mem = memory[key];
    const client_id = byName.get(key) ?? (mem && clients.some((c) => c.id === mem.client_id) ? mem.client_id : "");
    const options = client_id ? sitesOf(client_id) : [];
    const location_id =
      options.length === 1 ? options[0].id : options.find((s) => s.id === mem?.location_id)?.id ?? "";
    return { client_id, location_id, skip: r.commission <= 0 };
  }

  function onFile(file: File | undefined) {
    setRows([]);
    setChoices([]);
    setFileErrors([]);
    setResult({});
    if (!file) return;
    setFileName(file.name);
    Papa.parse<string[]>(file, {
      complete: ({ data }) => {
        try {
          const parsed = parseCommissionFile(data);
          if (parsed.rows.length > MAX_COMMISSION_ROWS) {
            setFileErrors([`The file has ${parsed.rows.length} customers. Please import at most ${MAX_COMMISSION_ROWS} at a time.`]);
            return;
          }
          if (parsed.rows.length === 0 && parsed.errors.length === 0) {
            setFileErrors(["The file has headings but no customers."]);
            return;
          }
          const memory = remembered();
          setFileErrors(parsed.errors);
          setRows(parsed.rows);
          setChoices(parsed.rows.map((r) => guess(r, memory)));
        } catch (e) {
          setFileErrors([e instanceof Error ? e.message : "This file couldn't be read."]);
        }
      },
      error: (err) => setFileErrors([`Could not read the file: ${err.message}`]),
    });
  }

  function change(i: number, patch: Partial<Choice>) {
    setResult({});
    setChoices((cs) =>
      cs.map((c, j) => {
        if (j !== i) return c;
        const next = { ...c, ...patch };
        if (patch.client_id !== undefined) {
          const options = sitesOf(patch.client_id);
          next.location_id = options.length === 1 ? options[0].id : "";
        }
        return next;
      }),
    );
  }

  const included = rows.map((r, i) => ({ r, c: choices[i] })).filter(({ r, c }) => c && !c.skip && !isDone(r, c));
  const missing = included.filter(({ c }) => !c.client_id || !c.location_id);
  const total = Math.round(included.reduce((t, { r }) => t + r.commission, 0) * 100) / 100;

  function onImport() {
    startTransition(async () => {
      const res = await importCommission(
        included.map(({ r, c }) => ({
          line: r.line,
          customer: r.customer,
          client_id: c.client_id,
          location_id: c.location_id,
          period_start: r.period_start,
          period_end: r.period_end,
          net_sales: r.net_sales,
          commission: r.commission,
        })),
        method,
        reference,
        fileName,
      );
      if (res.imported) {
        remember(Object.fromEntries(included.map(({ r, c }) => [nameKey(r.customer), { client_id: c.client_id, location_id: c.location_id }])));
      }
      setResult(res);
    });
  }

  if (result.imported) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-green-50 p-4 text-green-900">
          Recorded {result.imported} commission payment{result.imported === 1 ? "" : "s"}, {formatAud(result.total ?? 0)} in total.
        </p>
        <div className="flex gap-3">
          <Link href="/commission" className="btn-primary">
            View payments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600">
        <li>In Seed, run the Commission summary for the period and save it as CSV.</li>
        <li>Choose it below. Each customer becomes one payment, dated the period&apos;s end date, with its Net Sales and Commissions.</li>
        <li>Check the customer and site for each row. Nothing is saved until you click Import.</li>
      </ol>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Seed commission summary (.csv)</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm file:mr-3 file:min-h-12 file:rounded-xl file:border-0 file:bg-brand-strong file:px-5 file:py-3 file:text-base file:font-bold file:text-white"
        />
      </label>

      {fileErrors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-md bg-red-50 p-3 text-sm text-red-900">
          {fileErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-ink">How they were paid</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-ink">Reference (optional, for every payment)</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="input" maxLength={200} />
            </label>
          </div>

          <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
            {rows.map((r, i) => {
              const c = choices[i];
              const already = isDone(r, c);
              const options = c.client_id ? sitesOf(c.client_id) : [];
              const off = c.skip || already;
              return (
                <li key={r.line} className={`flex flex-col gap-2 p-4 ${off ? "bg-zinc-50 text-zinc-500" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0">
                      <span className="font-bold">{r.customer}</span>{" "}
                      <span className="text-sm text-zinc-500">
                        {formatDate(r.period_start)} to {formatDate(r.period_end)}
                        {r.net_sales !== null && ` · Net sales ${formatAud(r.net_sales)}`}
                      </span>
                    </p>
                    <span className="font-bold">{formatAud(r.commission)}</span>
                  </div>

                  {already ? (
                    <p className="text-sm">Already recorded for this period, so it will be skipped.</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={c.client_id}
                        onChange={(e) => change(i, { client_id: e.target.value })}
                        disabled={c.skip}
                        aria-label={`Customer for ${r.customer}`}
                        className={`input min-w-0 flex-1 ${!c.client_id && !c.skip ? "ring-2 ring-amber-500" : ""}`}
                      >
                        <option value="">Choose the customer…</option>
                        {clients.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      {c.client_id && options.length === 0 && (
                        <span className="text-sm text-amber-800">This customer has no sites. Add one first, or skip it.</span>
                      )}
                      {options.length > 0 && (
                        <select
                          value={c.location_id}
                          onChange={(e) => change(i, { location_id: e.target.value })}
                          disabled={c.skip}
                          aria-label={`Site for ${r.customer}`}
                          className={`input min-w-0 flex-1 ${!c.location_id && !c.skip ? "ring-2 ring-amber-500" : ""}`}
                        >
                          <option value="">Choose the site…</option>
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={c.skip} onChange={(e) => change(i, { skip: e.target.checked })} />
                        Skip
                      </label>
                    </div>
                  )}
                  {r.commission <= 0 && !already && <p className="text-sm">No commission owed, so it&apos;s skipped.</p>}
                </li>
              );
            })}
          </ul>

          {result.error && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">
              {result.error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onImport}
              disabled={pending || included.length === 0 || missing.length > 0}
              className="btn-primary"
            >
              {pending ? "Importing…" : `Import ${included.length} payment${included.length === 1 ? "" : "s"} (${formatAud(total)})`}
            </button>
            {missing.length > 0 && (
              <span className="text-sm text-amber-800">
                Choose the customer and site for {missing.length} row{missing.length === 1 ? "" : "s"} (outlined), or skip them.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
