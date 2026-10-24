"use client";

import { useActionState } from "react";
import { setArchived } from "../actions";
import { FormMessage, type FormState } from "@/components/form-ui";

// Archive hides the customer from lists; nothing is deleted and it can be undone.
export function ArchiveButton({ clientId, archived }: { clientId: string; archived: boolean }) {
  const [state, formAction, pending] = useActionState<FormState>(setArchived.bind(null, clientId, !archived), {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!archived && !confirm("Archive this customer? It's hidden from your lists but nothing is deleted, and you can bring it back any time.")) {
          e.preventDefault();
        }
      }}
      className="flex max-w-lg flex-col gap-3 border-t-2 border-zinc-200 pt-6"
    >
      <h2 className="section-title">{archived ? "Archived customer" : "Archive this customer"}</h2>
      <p className="text-sm text-zinc-600">
        {archived
          ? "This customer is hidden from your lists. Bring it back to use it again."
          : "For old, test or duplicate customers. Their sites, contacts, payments and history are kept."}
      </p>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Saving…" : archived ? "Unarchive" : "Archive customer"}
        </button>
      </div>
    </form>
  );
}
