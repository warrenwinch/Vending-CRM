"use client";

import { useActionState } from "react";
import { deleteLocation } from "../../actions";
import { FormMessage, type FormState } from "@/components/form-ui";

// For sites added by mistake. Asks first, because it can't be undone.
export function DeleteLocation({ locationId, siteName }: { locationId: string; siteName: string }) {
  const [state, formAction, pending] = useActionState<FormState>(deleteLocation.bind(null, locationId), {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Delete ${siteName}? Its notes are deleted too; its contacts move to "All sites" for the customer. This can't be undone.`)) {
          e.preventDefault();
        }
      }}
      className="flex max-w-lg flex-col gap-3 border-t-2 border-zinc-200 pt-6"
    >
      <h2 className="section-title">Delete this site</h2>
      <p className="text-sm text-zinc-600">
        Only for sites added by mistake. A site with machine, fault or commission history can&apos;t be deleted; set it to
        Lost instead.
      </p>
      <FormMessage state={state} />
      <div>
        <button type="submit" disabled={pending} className="btn-danger">
          {pending ? "Checking…" : "Delete site"}
        </button>
      </div>
    </form>
  );
}
