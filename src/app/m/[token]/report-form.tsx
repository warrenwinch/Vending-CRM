"use client";

import { useActionState } from "react";
import { reportFromQr } from "./actions";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField, type FormState } from "@/components/form-ui";
import { CUSTOMER_FAULT_CHOICES } from "@/lib/fault-types";

export function CustomerReportForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(reportFromQr.bind(null, token), {});
  const v = state.values;

  if (state.message) {
    return (
      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <p className="text-zinc-600">You can close this page now.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SelectField
        label="What's wrong?"
        name="category"
        options={[{ value: "", label: "Choose…" }, ...CUSTOMER_FAULT_CHOICES]}
        defaultValue={v?.category ?? ""}
        required
      />
      <SelectField
        label="Is the machine working at all?"
        name="severity"
        options={[
          { value: "partly_working", label: "Yes, partly" },
          { value: "not_working", label: "No, not at all" },
        ]}
        defaultValue={v?.severity ?? "partly_working"}
      />
      <TextAreaField
        label="Tell us more"
        name="description"
        placeholder="e.g. Paid $3.50 by card for a Coke in B4, it didn't drop"
        maxLength={1000}
        defaultValue={v?.description ?? ""}
        required
      />
      <Field
        label="Your name and phone or email (optional)"
        name="contact"
        maxLength={200}
        autoComplete="off"
        hint="Only if you'd like us to get back to you, for example about a refund."
        defaultValue={v?.contact ?? ""}
      />
      {/* Hidden from people; robots fill it in and are ignored. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Send report</SubmitButton>
    </form>
  );
}
