"use client";

import { useActionState } from "react";
import { logIn } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form-ui";

export function LoginForm({ notice }: { notice?: FormState }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    logIn,
    notice ?? {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}
