"use client";

import { useActionState } from "react";
import { createOrganization } from "./actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form-ui";

export function SetupForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createOrganization,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Business name"
        name="business_name"
        autoComplete="organization"
        hint="The name your customers know you by. You can change it later."
        required
      />
      <Field label="Your name" name="full_name" autoComplete="name" defaultValue={defaultName} required />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Continue</SubmitButton>
    </form>
  );
}
