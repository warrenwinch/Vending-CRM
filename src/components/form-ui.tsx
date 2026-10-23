// Small building blocks shared by every form, sized for phones.
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// values: what the person typed, handed back so a failed save doesn't wipe the form.
export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input {...input} className={inputClass} />
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  ...textarea
}: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <textarea rows={3} {...textarea} className={inputClass} />
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  options,
  ...select
}: {
  label: string;
  options: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <select {...select} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  ...input
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-3 py-1">
      <input type="checkbox" {...input} className="size-5 accent-zinc-900 dark:accent-zinc-100" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p aria-live="polite" className="rounded-md bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">
        {state.message}
      </p>
    );
  }
  return null;
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="text-sm font-medium text-zinc-500">Vending CRM</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </main>
  );
}
