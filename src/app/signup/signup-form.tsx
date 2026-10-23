"use client";

import { useActionState } from "react";
import { signUp } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form-ui";

export function SignupForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signUp, {});

  if (state.message) return <FormMessage state={state} />;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Your name" name="full_name" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="At least 8 characters."
        required
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
