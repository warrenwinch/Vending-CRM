import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { isUuid } from "@/lib/ids";
import { ClientForm } from "../../client-form";

export default function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  return (
    <>
      <h1 className="page-title">Edit customer</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditClient params={params} />
      </Suspense>
    </>
  );
}

async function EditClient({ params }: Pick<PageProps<"/clients/[id]/edit">, "params">) {
  await requireRole(OFFICE_ROLES);
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const client = await getClient(id);
  if (!client) notFound();

  return <ClientForm client={client} />;
}
