"use client";

import { useActionState } from "react";
import { acceptInvitation, createOrganization } from "./actions";
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

export function JoinForm({
  invitationId,
  businessName,
  roleLabel,
  defaultName,
}: {
  invitationId: string;
  businessName: string;
  roleLabel: string;
  defaultName: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    acceptInvitation.bind(null, invitationId),
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border-2 border-zinc-200 bg-white p-4">
      <p>
        <span className="font-semibold">{businessName}</span> has invited you to join as{" "}
        <span className="font-semibold">{roleLabel}</span>.
      </p>
      <Field label="Your name" name="full_name" autoComplete="name" defaultValue={defaultName} required />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Join {businessName}</SubmitButton>
    </form>
  );
}
