"use client";

import { useActionState } from "react";
import { addTag, createTag, deleteTag, removeTag, updateTag } from "./tag-actions";
import { FormMessage, type FormState } from "@/components/form-ui";
import { TAG_COLOURS, tagChipClass, type Tag } from "@/lib/tag-types";

export function TagChip({ tag, children }: { tag: Tag; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${tagChipClass(tag.colour)}`}>
      {tag.name}
      {children}
    </span>
  );
}

// A machine's tags: tap × to take one off, or type to add (new names create a tag).
export function MachineTags({ machineId, tags, allTags }: { machineId: string; tags: Tag[]; allTags: Tag[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addTag.bind(null, machineId), {});
  const onMachine = new Set(tags.map((t) => t.id));

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t.id}>
              <TagChip tag={t}>
                <form action={removeTag.bind(null, machineId, t.id)} className="contents">
                  <button
                    type="submit"
                    aria-label={`Remove ${t.name}`}
                    className="-mr-1 ml-1 flex size-6 items-center justify-center rounded-full text-base leading-none hover:bg-black/10"
                  >
                    ×
                  </button>
                </form>
              </TagChip>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No tags yet.</p>
      )}
      <form action={formAction} className="flex gap-2">
        <input
          name="name"
          list="all-tags"
          maxLength={40}
          defaultValue={state.values?.name ?? ""}
          placeholder="Add a tag, e.g. Cashless"
          aria-label="Add a tag"
          className="input min-w-0 flex-1"
          required
        />
        <datalist id="all-tags">
          {allTags
            .filter((t) => !onMachine.has(t.id))
            .map((t) => (
              <option key={t.id} value={t.name} />
            ))}
        </datalist>
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {state.error && <FormMessage state={state} />}
    </div>
  );
}

export function NewTagForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTag, {});
  const v = state.values;
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-2 ring-zinc-200">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="name"
          maxLength={40}
          defaultValue={v?.name ?? ""}
          placeholder="New tag, e.g. Night route"
          aria-label="New tag name"
          className="input min-w-0 flex-1"
          required
        />
        <select name="colour" defaultValue={v?.colour ?? "grey"} aria-label="Colour" className="input">
          {TAG_COLOURS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Adding…" : "Add tag"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

// One row on the Manage tags page (office only): rename, recolour or delete.
export function EditTagForm({ tag }: { tag: Tag }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateTag.bind(null, tag.id), {});
  const v = state.values;
  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          name="name"
          maxLength={40}
          defaultValue={v?.name ?? tag.name}
          aria-label="Tag name"
          className="input min-w-0 flex-1"
          required
        />
        <select name="colour" defaultValue={v?.colour ?? tag.colour} aria-label="Colour" className="input">
          {TAG_COLOURS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      <form
        action={deleteTag.bind(null, tag.id)}
        onSubmit={(e) => {
          if (!confirm(`Delete the tag “${tag.name}”? It will be taken off every machine.`)) e.preventDefault();
        }}
      >
        <button type="submit" className="text-sm font-medium text-red-700 underline">
          Delete this tag
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
