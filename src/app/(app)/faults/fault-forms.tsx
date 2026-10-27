"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { assignFault, deleteFault, markFixed, reportFault, sendSummaryNow } from "./actions";
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  type FormState,
} from "@/components/form-ui";
import { FAULT_CATEGORIES, FAULT_SEVERITIES } from "@/lib/fault-types";

// "2026-10-23T14:15" for the phone's date-and-time picker, in its own time zone.
function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// A date-and-time picker. The exact moment is sent alongside, so the
// server never has to guess the phone's time zone.
const noSubscribe = () => () => {};

function WhenField({ label, name }: { label: string; name: string }) {
  // Only drawn once the page is running on the phone, so it starts at the
  // phone's clock rather than the server's.
  const onDevice = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!onDevice) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        <div className="h-11 rounded-md border border-zinc-200" />
      </div>
    );
  }
  return <WhenInput label={label} name={name} />;
}

function WhenInput({ label, name }: { label: string; name: string }) {
  const [now] = useState(localNow);
  const [local, setLocal] = useState(now);
  const exact = local ? new Date(local).toISOString() : "";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="datetime-local"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        max={now}
        required
        className="input"
      />
      <input type="hidden" name={name} value={exact} />
    </label>
  );
}

export function ReportFaultForm({ machineId }: { machineId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(reportFault.bind(null, machineId), {});
  const v = state.values;
  const [alreadyFixed, setAlreadyFixed] = useState(v?.already_fixed === "on");

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <SelectField
        label="What's wrong"
        name="category"
        options={[{ value: "", label: "Choose…" }, ...FAULT_CATEGORIES]}
        defaultValue={v?.category ?? ""}
        required
      />
      <SelectField label="How bad" name="severity" options={FAULT_SEVERITIES} defaultValue={v?.severity ?? "partly_working"} />
      <TextAreaField
        label="Describe the fault"
        name="description"
        placeholder="Coil B4 jammed, chips stuck"
        maxLength={2000}
        defaultValue={v?.description ?? ""}
        required
      />
      <WhenField label="When you found it" name="found_at" />

      <CheckboxField
        label="I've already fixed it"
        name="already_fixed"
        checked={alreadyFixed}
        onChange={(e) => setAlreadyFixed(e.target.checked)}
      />
      {alreadyFixed && (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-zinc-200 bg-white p-4">
          <WhenField label="When you fixed it" name="fixed_at" />
          <TextAreaField label="What you did (optional)" name="fix_notes" placeholder="Cleared the jam, re-seated the coil" defaultValue={v?.fix_notes ?? ""} />
        </div>
      )}

      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>{alreadyFixed ? "Save fixed fault" : "Report fault"}</SubmitButton>
        <Link href={`/machines/${machineId}`} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function MarkFixedForm({ faultId }: { faultId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(markFixed.bind(null, faultId), {});
  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4 rounded-2xl border-2 border-zinc-200 bg-white p-4">
      <h2 className="section-title">Mark as fixed</h2>
      <WhenField label="When you fixed it" name="fixed_at" />
      <TextAreaField label="What you did (optional)" name="fix_notes" defaultValue={state.values?.fix_notes ?? ""} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending}>Mark fixed</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteFaultButton({ faultId, machineId }: { faultId: string; machineId: string }) {
  return (
    <form
      action={deleteFault.bind(null, faultId, machineId)}
      onSubmit={(e) => {
        if (!confirm("Delete this fault record? This can't be undone.")) e.preventDefault();
      }}
      className="border-t border-zinc-200 pt-4"
    >
      <button type="submit" className="text-sm font-medium text-red-700 underline">
        Delete this fault record
      </button>
    </form>
  );
}

// For Administrators: email this week's summary now instead of waiting for Monday.
export function SendSummaryNow() {
  const [state, formAction, pending] = useActionState<FormState>(sendSummaryNow, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="btn-small">
        {pending ? "Sending…" : "Email weekly summary now"}
      </button>
      {state.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
      {state.message && <span className="text-sm text-leaf-deep">{state.message}</span>}
    </form>
  );
}

// Who the repair is given to (Administrators, Managers and Warehouse).
export function AssignFaultForm({
  faultId,
  assignedTo,
  team,
}: {
  faultId: string;
  assignedTo: string | null;
  team: { value: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(assignFault.bind(null, faultId), {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <SelectField
            label="Assigned to"
            name="assigned_to"
            options={[{ value: "", label: "Nobody yet" }, ...team]}
            defaultValue={state.values?.assigned_to ?? assignedTo ?? ""}
          />
        </div>
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
