"use client";

// Sales IDs already tied to a machine: find one and change it if it's wrong.
// Changing it moves every month already imported for that ID.
import { useState } from "react";
import { linkSale } from "./actions";
import type { Matched } from "@/lib/sales";
import { sourceLabel } from "@/lib/sales-import";
import { formatAud } from "@/lib/au";

type MachineOption = { value: string; label: string };

export function MatchedList({ matched, machines }: { matched: Matched[]; machines: MachineOption[] }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const labels = new Map(machines.map((m) => [m.value, m.label]));
  const label = (m: Matched) => labels.get(m.machine_id) ?? "Machine no longer listed";

  const term = search.trim().toLowerCase();
  const shown = term
    ? matched.filter((m) => [m.external_id, m.external_name, sourceLabel(m.source), label(m)].join(" ").toLowerCase().includes(term))
    : matched;

  return (
    <details className="text-sm text-zinc-600">
      <summary className="cursor-pointer font-bold">Already matched ({matched.length})</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p>Tied one to the wrong machine? Find it, click Change and choose the right one. Every month already imported moves with it.</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, name or machine…"
          aria-label="Search matched sales IDs"
          className="input"
        />
        {shown.length === 0 ? (
          <p className="text-zinc-500">Nothing matches that search.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
            {shown.map((m) => {
              const key = `${m.source}|${m.external_id}`;
              return (
                <li key={key} className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0">
                      <span className="font-bold text-ink">{m.external_id}</span>{" "}
                      <span className="text-zinc-500">
                        {sourceLabel(m.source)}
                        {m.external_name && ` · ${m.external_name}`}
                      </span>
                    </p>
                    <span className="font-bold text-ink">{formatAud(m.total)}</span>
                  </div>
                  {editing === key ? (
                    <form
                      action={async (formData) => {
                        await linkSale(m.source, m.external_id, formData);
                        setEditing(null);
                      }}
                      className="flex flex-wrap gap-2"
                    >
                      <select name="machine_id" required defaultValue={m.machine_id} aria-label={`Machine for ${m.external_id}`} className="input min-w-0 flex-1">
                        <option value="none">Don&apos;t track this one</option>
                        {machines.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn-secondary">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="underline">
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <p className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0">{label(m)}</span>
                      <button type="button" onClick={() => setEditing(key)} className="btn-small">
                        Change
                      </button>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
