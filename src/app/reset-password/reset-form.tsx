"use client";

import { useActionState } from "react";
import { setNewPassword } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form-ui";

export function ResetForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setNewPassword, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="At least 8 characters."
        required
      />
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
