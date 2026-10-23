import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { listLocations } from "@/lib/locations";
import { isUuid } from "@/lib/ids";
import { ContactForm } from "../contact-form";

export default function NewContactPage({ params, searchParams }: PageProps<"/clients/[id]/contacts/new">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <NewContact params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewContact({ params, searchParams }: PageProps<"/clients/[id]/contacts/new">) {
  await requireRole(OFFICE_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [client, sites, { location }] = await Promise.all([
    getClient(id),
    listLocations({ clientId: id }),
    searchParams,
  ]);
  if (!client) notFound();

  return (
    <>
      <div>
        <Link href={`/clients/${id}`} className="text-sm font-medium text-zinc-500 underline">
          {client.company_name}
        </Link>
        <h1 className="page-title">Add a contact</h1>
      </div>
      <ContactForm
        clientId={id}
        sites={sites.map((s) => ({ value: s.id, label: s.site_name }))}
        defaultLocationId={isUuid(location) ? location : undefined}
      />
    </>
  );
}
