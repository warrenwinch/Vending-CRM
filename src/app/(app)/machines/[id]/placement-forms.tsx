"use client";

import Link from "next/link";
import { useActionState } from "react";
import { placeMachine, takeOutMachine } from "./placement-actions";
import { Field, FormMessage, SelectField, SubmitButton, type FormState } from "@/components/form-ui";

type Option = { value: string; label: string };

export function PlaceForm({
  machineId,
  locations,
  today,
  moving,
  defaultLocationId,
}: {
  machineId: string;
  locations: Option[];
  today: string;
  moving: boolean;
  defaultLocationId?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    placeMachine.bind(null, machineId),
    {},
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <SelectField
        label={moving ? "Move to" : "Place at"}
        name="location_id"
        options={[{ value: "", label: "Choose a location…" }, ...locations]}
        defaultValue={v?.location_id ?? defaultLocationId ?? ""}
        required
      />
      <Field
        label="Position on site (optional)"
        name="position"
        placeholder="Level 4N, next to the lifts"
        hint="Where in the building it sits. To move it within the same site, choose that site again with the new position."
        maxLength={200}
        defaultValue={v?.position ?? ""}
      />
      <Field
        label={moving ? "Date moved" : "Date installed"}
        name="date"
        type="date"
        max={today}
        defaultValue={v?.date ?? today}
        required
      />
      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>{moving ? "Move machine" : "Place machine"}</SubmitButton>
        <Link href={`/machines/${machineId}`} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function TakeOutForm({ machineId, today, since }: { machineId: string; today: string; since: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    takeOutMachine.bind(null, machineId),
    {},
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <SelectField
        label="What happens to it"
        name="status"
        options={[
          { value: "in_storage", label: "Back to storage" },
          { value: "needs_repair", label: "Needs repair" },
        ]}
        defaultValue={v?.status ?? "in_storage"}
      />
      <Field label="Date taken out" name="date" type="date" min={since} max={today} defaultValue={v?.date ?? today} required />
      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>Take out</SubmitButton>
        <Link href={`/machines/${machineId}`} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
