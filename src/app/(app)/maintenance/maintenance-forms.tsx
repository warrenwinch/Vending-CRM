"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addPlans, deletePlan, markDone, updatePlan } from "./actions";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField, type FormState } from "@/components/form-ui";
import type { MachineChoice } from "@/lib/maintenance";

type PlanValues = { task?: string; every_count?: string; every_unit?: string; next_due?: string; notes?: string };

// What the job is, how often, and when it's next due.
function PlanFields({ v, today, suggestions, dueLabel }: { v: PlanValues; today: string; suggestions: string[]; dueLabel: string }) {
  return (
    <>
      <Field
        label="Job"
        name="task"
        list="maintenance-tasks"
        maxLength={120}
        placeholder="e.g. Full clean, inside and out"
        hint="Pick one from the list or type your own."
        defaultValue={v.task ?? ""}
        required
      />
      <datalist id="maintenance-tasks">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="flex items-end gap-3">
        <Field
          label="How often: every"
          name="every_count"
          type="number"
          inputMode="numeric"
          min={1}
          max={104}
          defaultValue={v.every_count ?? "4"}
          required
        />
        <SelectField
          label="Weeks or months"
          name="every_unit"
          options={[
            { value: "weeks", label: "weeks" },
            { value: "months", label: "months" },
          ]}
          defaultValue={v.every_unit ?? "weeks"}
        />
      </div>
      <Field label={dueLabel} name="next_due" type="date" defaultValue={v.next_due ?? today} required />
      <TextAreaField
        label="Notes (optional)"
        name="notes"
        maxLength={1000}
        placeholder="e.g. Use the stainless cleaner on the glass"
        defaultValue={v.notes ?? ""}
      />
    </>
  );
}

type MachineOption = MachineChoice;

// Adds one job to as many machines as are ticked, grouped by site.
export function AddPlansForm({
  machines,
  preselected,
  today,
  suggestions,
  back,
}: {
  machines: MachineOption[];
  preselected: string[];
  today: string;
  suggestions: string[];
  back: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addPlans.bind(null, back), {});
  const v = state.values ?? {};
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(v.machine_ids ? v.machine_ids.split(",") : preselected),
  );
  const [filter, setFilter] = useState("");

  const sites = new Map<string, MachineOption[]>();
  for (const m of machines) {
    const key = m.site ?? "In storage";
    if (!sites.has(key)) sites.set(key, []);
    sites.get(key)!.push(m);
  }
  // Sites with a ticked machine always stay in view, so every tick is sent.
  const words = filter.trim().toLowerCase();
  const shown = [...sites.entries()].filter(
    ([site, list]) =>
      !words ||
      site.toLowerCase().includes(words) ||
      list.some((m) => m.machine_number.toLowerCase().includes(words)) ||
      list.some((m) => ticked.has(m.id)),
  );

  const toggle = (ids: string[], on: boolean) =>
    setTicked((old) => {
      const next = new Set(old);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <PlanFields v={v} today={today} suggestions={suggestions} dueLabel="First due" />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-bold text-ink">
          Machines ({ticked.size} ticked)
        </legend>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a site or machine number"
          className="input"
        />
        <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto rounded-2xl border-2 border-zinc-200 bg-white p-3">
          {shown.length === 0 && <p className="text-sm text-zinc-500">No machines match.</p>}
          {shown.map(([site, list]) => {
            const ids = list.map((m) => m.id);
            const all = ids.every((id) => ticked.has(id));
            return (
              <div key={site} className="flex flex-col gap-1">
                <label className="flex items-center gap-3 font-bold">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    className="size-5 accent-brand-strong"
                  />
                  {site} {list.length > 1 && <span className="text-sm font-medium text-zinc-500">(all {list.length})</span>}
                </label>
                {list.map((m) => (
                  <label key={m.id} className="ml-8 flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="machine_id"
                      value={m.id}
                      checked={ticked.has(m.id)}
                      onChange={(e) => toggle([m.id], e.target.checked)}
                      className="size-5 accent-brand-strong"
                    />
                    <span className="font-mono font-semibold">{m.machine_number}</span>
                    {m.position && <span className="text-zinc-600">{m.position}</span>}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>
          {ticked.size > 1 ? `Add to ${ticked.size} machines` : "Add maintenance"}
        </SubmitButton>
        <Link href={back} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function EditPlanForm({
  planId,
  initial,
  today,
  suggestions,
}: {
  planId: string;
  initial: PlanValues;
  today: string;
  suggestions: string[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePlan.bind(null, planId), {});
  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <PlanFields v={state.values ?? initial} today={today} suggestions={suggestions} dueLabel="Next due" />
      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>Save</SubmitButton>
        <Link href={`/maintenance/${planId}`} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function MarkDoneForm({ planId, today }: { planId: string; today: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(markDone.bind(null, planId), {});
  const v = state.values;
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <Field label="Date done" name="done_on" type="date" max={today} defaultValue={v?.done_on ?? today} required />
      <TextAreaField
        label="Notes (optional)"
        name="notes"
        maxLength={1000}
        placeholder="e.g. Delivery bin was sticky, cleaned the flap"
        defaultValue={v?.notes ?? ""}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Mark done</SubmitButton>
    </form>
  );
}

export function DeletePlanButton({ planId, machineId }: { planId: string; machineId: string }) {
  return (
    <form
      action={deletePlan.bind(null, planId, machineId)}
      onSubmit={(e) => {
        if (!confirm("Stop this regular job? Its history stays on the machine.")) e.preventDefault();
      }}
      className="border-t border-zinc-200 pt-4"
    >
      <button type="submit" className="text-sm font-medium text-red-700 underline">
        Stop this regular job
      </button>
    </form>
  );
}
