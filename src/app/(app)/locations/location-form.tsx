"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveLocation } from "./actions";
import {
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  type FormState,
} from "@/components/form-ui";
import {
  COMMISSION_TYPES,
  LOCATION_STATUSES,
  LOCATION_TYPES,
  type CommissionType,
  type Location,
} from "@/lib/location-types";

type Option = { value: string; label: string };

export function LocationForm({
  location,
  clients,
  clientId,
  cancelHref,
}: {
  location?: Location;
  clients: Option[];
  clientId?: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveLocation.bind(null, location?.id ?? null),
    {},
  );

  // After a failed save, show what was typed; otherwise the saved values.
  const v = state.values;
  const value = (name: string, saved: string | number | null | undefined) =>
    v?.[name] ?? (saved === null || saved === undefined ? "" : String(saved));

  // The rate box only appears, and changes its label, for the chosen commission type.
  const [commission, setCommission] = useState<CommissionType>(
    (v?.commission_type as CommissionType) ?? location?.commission_type ?? "none",
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <SelectField
        label="Client"
        name="client_id"
        options={[{ value: "", label: "Choose a client…" }, ...clients]}
        defaultValue={value("client_id", location?.client_id ?? clientId)}
        required
      />
      <Field label="Site name" name="site_name" defaultValue={value("site_name", location?.site_name)} required />
      <TextAreaField
        label="Address"
        name="address"
        rows={2}
        autoComplete="street-address"
        defaultValue={value("address", location?.address)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Type of site"
          name="type"
          options={LOCATION_TYPES}
          defaultValue={value("type", location?.type ?? "other")}
        />
        <SelectField
          label="Status"
          name="status"
          options={LOCATION_STATUSES}
          defaultValue={value("status", location?.status ?? "prospect")}
        />
      </div>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold">On site</legend>
        <TextAreaField
          label="Where the machines go"
          name="placement_notes"
          placeholder="Ground floor staff room, next to the lifts"
          defaultValue={value("placement_notes", location?.placement_notes)}
        />
        <TextAreaField
          label="Access instructions"
          name="access_instructions"
          placeholder="Sign in at reception. Loading dock code 1234."
          defaultValue={value("access_instructions", location?.access_instructions)}
        />
        <Field
          label="Operating hours"
          name="operating_hours"
          placeholder="Mon–Fri 7am–6pm"
          defaultValue={value("operating_hours", location?.operating_hours)}
        />
        <Field
          label="Foot traffic"
          name="foot_traffic"
          placeholder="About 200 staff"
          defaultValue={value("foot_traffic", location?.foot_traffic)}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold">Commission paid to the client</legend>
        <SelectField
          label="Commission type"
          name="commission_type"
          options={COMMISSION_TYPES}
          value={commission}
          onChange={(e) => setCommission(e.target.value as CommissionType)}
        />
        {commission !== "none" && (
          <Field
            key={commission}
            label={commission === "percentage" ? "Rate (% of sales)" : "Amount per month ($ AUD)"}
            name="commission_rate"
            inputMode="decimal"
            placeholder={commission === "percentage" ? "10" : "150.00"}
            defaultValue={value("commission_rate", location?.commission_type === commission ? location.commission_rate : null)}
            required
          />
        )}
      </fieldset>

      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>{location ? "Save changes" : "Add location"}</SubmitButton>
        <Link href={cancelHref} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
