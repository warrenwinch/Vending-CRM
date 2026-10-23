"use client";

import { useActionState } from "react";
import { addNote, deleteNote } from "./actions";
import { FormMessage, SubmitButton, type FormState } from "@/components/form-ui";
import type { NoteTarget } from "@/lib/notes";

export function NoteForm({ target }: { target: NoteTarget }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addNote.bind(null, target), {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="sr-only">New note</span>
        <textarea
          name="body"
          rows={3}
          maxLength={2000}
          required
          placeholder="Add a note…"
          defaultValue={state.values?.body ?? ""}
          className="input"
        />
      </label>
      {state.error && <FormMessage state={state} />}
      <div>
        <SubmitButton pending={pending}>Add note</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteNoteButton({ noteId, target }: { noteId: string; target: NoteTarget }) {
  return (
    <form
      action={deleteNote.bind(null, noteId, target)}
      onSubmit={(e) => {
        if (!confirm("Delete this note? This can't be undone.")) e.preventDefault();
      }}
    >
      <button type="submit" className="text-xs font-medium text-red-700 underline">
        Delete
      </button>
    </form>
  );
}
