"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveClient } from "./actions";
import {
  CheckboxField,
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
  type FormState,
} from "@/components/form-ui";
import { CLIENT_STATUSES, type Client } from "@/lib/client-types";
import { formatAbn } from "@/lib/au";

export function ClientForm({ client }: { client?: Client }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveClient.bind(null, client?.id ?? null),
    {},
  );

  // After a failed save, show what was typed; otherwise the saved values.
  const v = state.values;
  const value = (name: keyof Client, saved: string | null | undefined) => v?.[name] ?? saved ?? "";

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field
        label="Company name"
        name="company_name"
        defaultValue={value("company_name", client?.company_name)}
        required
      />
      <Field
        label="ABN (optional)"
        name="abn"
        inputMode="numeric"
        placeholder="51 824 753 556"
        hint="11 digits. Spaces are fine."
        defaultValue={value("abn", formatAbn(client?.abn ?? null))}
      />
      <CheckboxField
        label="Registered for GST"
        name="gst_registered"
        defaultChecked={v ? v.gst_registered === "on" : (client?.gst_registered ?? false)}
      />

      <fieldset className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold">Billing contact</legend>
        <Field
          label="Name"
          name="billing_contact"
          autoComplete="off"
          defaultValue={value("billing_contact", client?.billing_contact)}
        />
        <Field
          label="Email"
          name="billing_email"
          type="email"
          autoComplete="off"
          defaultValue={value("billing_email", client?.billing_email)}
        />
        <Field
          label="Phone"
          name="billing_phone"
          type="tel"
          autoComplete="off"
          defaultValue={value("billing_phone", client?.billing_phone)}
        />
      </fieldset>

      <SelectField
        label="Status"
        name="status"
        options={CLIENT_STATUSES}
        defaultValue={value("status", client?.status ?? "prospect")}
      />

      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>{client ? "Save changes" : "Add client"}</SubmitButton>
        <Link href={client ? `/clients/${client.id}` : "/clients"} className="text-center text-sm font-medium underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
