"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteContact, saveContact } from "./actions";
import {
  CheckboxField,
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  type FormState,
} from "@/components/form-ui";
import type { Contact } from "@/lib/contact-types";

type Option = { value: string; label: string };

export function ContactForm({
  clientId,
  contact,
  sites,
  defaultLocationId,
}: {
  clientId: string;
  contact?: Contact;
  sites: Option[];
  defaultLocationId?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveContact.bind(null, clientId, contact?.id ?? null),
    {},
  );

  // After a failed save, show what was typed; otherwise the saved values.
  const v = state.values;
  const value = (name: string, saved: string | null | undefined) => v?.[name] ?? saved ?? "";

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Name" name="full_name" autoComplete="off" defaultValue={value("full_name", contact?.full_name)} required />
        <Field
          label="Role (optional)"
          name="role_title"
          placeholder="Facilities manager, decision-maker…"
          defaultValue={value("role_title", contact?.role_title)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" name="phone" type="tel" autoComplete="off" defaultValue={value("phone", contact?.phone)} />
          <Field label="Email" name="email" type="email" autoComplete="off" defaultValue={value("email", contact?.email)} />
        </div>
        <SelectField
          label="Site"
          name="location_id"
          options={[{ value: "", label: "All sites (the whole customer)" }, ...sites]}
          defaultValue={value("location_id", contact?.location_id ?? defaultLocationId)}
        />
        <CheckboxField
          label="Main contact for this customer"
          name="is_main_contact"
          defaultChecked={v ? v.is_main_contact === "on" : (contact?.is_main_contact ?? false)}
        />
        <TextAreaField label="Notes (optional)" name="notes" defaultValue={value("notes", contact?.notes)} />

        <FormMessage state={state} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton pending={pending}>{contact ? "Save changes" : "Add contact"}</SubmitButton>
          <Link href={`/clients/${clientId}`} className="text-center text-sm font-medium underline">
            Cancel
          </Link>
        </div>
      </form>

      {contact && (
        <form
          action={deleteContact.bind(null, clientId, contact.id)}
          onSubmit={(e) => {
            if (!confirm(`Delete ${contact.full_name}? This can't be undone.`)) e.preventDefault();
          }}
          className="border-t border-zinc-200 pt-4"
        >
          <button type="submit" className="text-sm font-medium text-red-700 underline">
            Delete this contact
          </button>
        </form>
      )}
    </div>
  );
}
