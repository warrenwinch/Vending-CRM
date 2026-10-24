"use client";

import { useActionState, useTransition, useState } from "react";
import { logIn, resendConfirmation } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form-ui";

export function LoginForm({ notice }: { notice?: FormState }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    logIn,
    notice ?? {},
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email ?? ""}
          required
        />
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
      {state.values?.unconfirmed && <ResendConfirmation email={state.values.email} />}
    </div>
  );
}

// For someone whose confirmation link went missing.
function ResendConfirmation({ email }: { email: string }) {
  const [result, setResult] = useState<FormState>({});
  const [sending, startSending] = useTransition();
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <p className="text-sm">Can&apos;t find the confirmation email?</p>
      <button
        type="button"
        disabled={sending}
        onClick={() => startSending(async () => setResult(await resendConfirmation(email)))}
        className="btn-secondary"
      >
        {sending ? "Sending…" : "Send confirmation email again"}
      </button>
      <FormMessage state={result} />
    </div>
  );
}
