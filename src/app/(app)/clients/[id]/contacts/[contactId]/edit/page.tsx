import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getContact } from "@/lib/contacts";
import { listLocations } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { ContactForm } from "../../contact-form";

export default function EditContactPage({ params }: PageProps<"/clients/[id]/contacts/[contactId]/edit">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <EditContact params={params} />
    </Suspense>
  );
}

async function EditContact({ params }: Pick<PageProps<"/clients/[id]/contacts/[contactId]/edit">, "params">) {
  await requireRole(OFFICE_ROLES);
  const { id, contactId } = await params;
  if (!isUuid(id) || !isUuid(contactId)) notFound();

  const [client, contact, sites] = await Promise.all([getClient(id), getContact(contactId), listLocations({ clientId: id })]);
  if (!client || !contact || contact.client_id !== id) notFound();

  return (
    <>
      <div>
        <Link href={`/clients/${id}`} className="text-sm font-medium text-zinc-500 underline">
          {client.company_name}
        </Link>
        <h1 className="page-title">Edit contact</h1>
      </div>
      <ContactForm clientId={id} contact={contact} sites={sites.map((s) => ({ value: s.id, label: s.site_name }))} />
    </>
  );
}
