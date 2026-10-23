// Contact cards with tap-to-call and tap-to-email, used on client and location pages.
import Link from "next/link";
import type { Contact } from "@/lib/contact-types";

export function ContactList({
  contacts,
  showSite,
  empty,
}: {
  contacts: Contact[];
  showSite: boolean;
  empty: React.ReactNode;
}) {
  if (contacts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {contacts.map((c) => (
        <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {c.full_name}
              {c.is_main_contact && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                  Main contact
                </span>
              )}
            </p>
            <p className="text-sm text-zinc-500">
              {[c.role_title, showSite ? (c.site_name ?? "All sites") : null].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {c.phone && (
                <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline">
                  {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="break-all underline">
                  {c.email}
                </a>
              )}
            </div>
            {c.notes && <p className="mt-1 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{c.notes}</p>}
          </div>
          <Link
            href={`/clients/${c.client_id}/contacts/${c.id}/edit`}
            className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
          >
            Edit
          </Link>
        </li>
      ))}
    </ul>
  );
}
