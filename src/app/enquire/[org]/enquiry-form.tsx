"use client";

import { useActionState } from "react";
import { submitEnquiry } from "./actions";
import { Field, FormMessage, SubmitButton, TextAreaField, type FormState } from "@/components/form-ui";

export function EnquiryForm({ org }: { org: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitEnquiry.bind(null, org), {});
  const v = state.values;

  if (state.message) return <FormMessage state={state} />;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Business name" name="company" maxLength={200} autoComplete="organization" defaultValue={v?.company ?? ""} required />
      <Field label="Your name" name="contact" maxLength={200} autoComplete="name" defaultValue={v?.contact ?? ""} required />
      <Field label="Email" name="email" type="email" maxLength={200} autoComplete="email" defaultValue={v?.email ?? ""} />
      <Field
        label="Phone"
        name="phone"
        type="tel"
        maxLength={40}
        autoComplete="tel"
        hint="An email or phone number, so we can get back to you."
        defaultValue={v?.phone ?? ""}
      />
      <Field
        label="Site address or suburb"
        name="address"
        maxLength={300}
        autoComplete="street-address"
        defaultValue={v?.address ?? ""}
      />
      <Field
        label="Roughly how many staff or visitors each day?"
        name="people"
        maxLength={100}
        placeholder="e.g. 80 staff"
        defaultValue={v?.people ?? ""}
      />
      <TextAreaField
        label="Anything else? (optional)"
        name="message"
        maxLength={2000}
        placeholder="e.g. We'd like a drinks and a snack machine in the staff room"
        defaultValue={v?.message ?? ""}
      />
      {/* Hidden from people; robots fill it in and are ignored. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Send enquiry</SubmitButton>
    </form>
  );
}
