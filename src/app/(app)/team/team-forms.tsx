"use client";

import { useActionState, useState } from "react";
import { inviteMember, updateMember } from "./actions";
import { Field, FormMessage, SelectField, SubmitButton, type FormState } from "@/components/form-ui";
import { ROLES, type Role } from "@/lib/auth-types";

const roleOptions = ROLES.map((r) => ({ value: r.value, label: r.label }));

export function InviteForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(inviteMember, {});
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Their name (optional)" name="full_name" autoComplete="off" defaultValue={v?.full_name ?? ""} />
        <Field label="Their email" name="email" type="email" autoComplete="off" defaultValue={v?.email ?? ""} required />
      </div>
      <SelectField label="Role" name="role" options={roleOptions} defaultValue={v?.role ?? "filler"} />
      <ul className="grid gap-1 text-xs text-zinc-500">
        {ROLES.map((r) => (
          <li key={r.value}>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{r.label}:</span> {r.description}
          </li>
        ))}
      </ul>
      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending}>Create invitation</SubmitButton>
      </div>
    </form>
  );
}

// One row per team member: role drop-down, access switch, Save.
export function MemberForm({
  memberId,
  role,
  active,
  isMe,
}: {
  memberId: string;
  role: Role;
  active: boolean;
  isMe: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateMember.bind(null, memberId), {});
  const [dirty, setDirty] = useState(false);

  if (isMe) {
    return <p className="text-sm text-zinc-500">{ROLES.find((r) => r.value === role)?.label} (you)</p>;
  }

  return (
    <form action={formAction} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)} className="flex flex-wrap items-center gap-3">
      <select
        name="role"
        defaultValue={role}
        aria-label="Role"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {roleOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} className="size-4 accent-zinc-900 dark:accent-zinc-100" />
        Can log in
      </label>
      <button
        type="submit"
        disabled={pending || !dirty}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <span role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</span>}
      {state.message && !dirty && <span className="text-sm text-green-700 dark:text-green-300">{state.message}</span>}
    </form>
  );
}

// The message to send someone, with a button to copy it.
export function CopyInvite({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <pre className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{text}</pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
      >
        {copied ? "Copied" : "Copy message"}
      </button>
    </div>
  );
}
