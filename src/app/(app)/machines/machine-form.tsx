"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveMachine } from "./actions";
import { Field, FormMessage, SelectField, SubmitButton, type FormState } from "@/components/form-ui";
import { MACHINE_STATUSES, MACHINE_TYPES, type Machine } from "@/lib/machine-types";

export function MachineForm({ machine, showCost }: { machine?: Machine; showCost: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveMachine.bind(null, machine?.id ?? null),
    {},
  );

  // After a failed save, show what was typed; otherwise the saved values.
  const v = state.values;
  const value = (name: string, saved: string | number | null | undefined) =>
    v?.[name] ?? (saved === null || saved === undefined ? "" : String(saved));

  // "Installed" comes from placing a machine at a location, not from this form.
  const statuses = MACHINE_STATUSES.filter(
    (s) => s.value !== "installed" || machine?.status === "installed",
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {machine && (
        <p className="text-sm text-zinc-500">
          Machine number <span className="font-semibold text-zinc-900 dark:text-zinc-100">{machine.machine_number}</span>{" "}
          (given automatically, can&apos;t be changed)
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Type of machine"
          name="type"
          options={MACHINE_TYPES}
          defaultValue={value("type", machine?.type ?? "snack")}
        />
        <SelectField
          label="Status"
          name="status"
          options={statuses}
          defaultValue={value("status", machine?.status ?? "in_storage")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Manufacturer" name="manufacturer" placeholder="Crane" defaultValue={value("manufacturer", machine?.manufacturer)} />
        <Field label="Model" name="model" placeholder="Merchant 6" defaultValue={value("model", machine?.model)} />
      </div>
      <Field label="Serial number" name="serial_number" defaultValue={value("serial_number", machine?.serial_number)} />
      <Field
        label="Payment hardware"
        name="payment_hardware"
        placeholder="Cash only, or card reader and provider"
        defaultValue={value("payment_hardware", machine?.payment_hardware)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Purchase date" name="purchase_date" type="date" defaultValue={value("purchase_date", machine?.purchase_date)} />
        {showCost && (
          <Field
            label="Purchase cost ($ AUD)"
            name="purchase_cost"
            inputMode="decimal"
            placeholder="4500.00"
            defaultValue={value("purchase_cost", machine?.purchase_cost?.toFixed(2))}
          />
        )}
      </div>

      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>{machine ? "Save changes" : "Add machine"}</SubmitButton>
        <Link href={machine ? `/machines/${machine.id}` : "/machines"} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
