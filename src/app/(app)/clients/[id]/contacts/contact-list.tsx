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
      <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
      {contacts.map((c) => (
        <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {c.full_name}
              {c.is_main_contact && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
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
            {c.notes && <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{c.notes}</p>}
          </div>
          <Link
            href={`/clients/${c.client_id}/contacts/${c.id}/edit`}
            className="btn-small self-start"
          >
            Edit
          </Link>
        </li>
      ))}
    </ul>
  );
}
