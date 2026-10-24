// Small building blocks shared by every form, sized for phones.
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// values: what the person typed, handed back so a failed save doesn't wipe the form.
export type FormState = { error?: string; message?: string; values?: Record<string, string> };

const inputClass = "input";
const labelClass = "text-sm font-bold text-ink";

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <input {...input} className={inputClass} />
      {hint && <span className="text-sm text-zinc-600">{hint}</span>}
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
      <span className={labelClass}>{label}</span>
      <textarea rows={3} {...textarea} className={inputClass} />
      {hint && <span className="text-sm text-zinc-600">{hint}</span>}
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
      <span className={labelClass}>{label}</span>
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
    <label className="flex min-h-12 items-center gap-3 rounded-xl bg-white px-4 py-2 ring-2 ring-zinc-200">
      <input type="checkbox" {...input} className="size-6 accent-brand-strong" />
      <span className="text-base font-bold">{label}</span>
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl border-l-8 border-red-600 bg-red-50 p-4 text-base font-medium text-red-900">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p aria-live="polite" className="rounded-xl border-l-8 border-leaf bg-leaf-soft p-4 text-base font-medium text-leaf-deep">
        {state.message}
      </p>
    );
  }
  return null;
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b-8 border-brand bg-ink px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-8 text-center">
        <p className="font-display text-4xl font-extrabold tracking-wide text-white uppercase">
          Vending <span className="text-brand">CRM</span>
        </p>
        <p className="mt-1 text-sm font-bold tracking-widest text-leaf uppercase">Customers · Sites · Machines</p>
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="page-title">{title}</h1>
        {children}
      </div>
    </main>
  );
}
