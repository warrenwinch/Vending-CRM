"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form-ui";

export function ForgotForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  if (state.message) return <FormMessage state={state} />;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Your email" name="email" type="email" autoComplete="email" required />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Email me a reset link</SubmitButton>
    </form>
  );
}
