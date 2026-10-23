import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <>
      <h1 className="page-title">Add a client</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewClient />
      </Suspense>
    </>
  );
}

async function NewClient() {
  await requireRole(OFFICE_ROLES);
  return <ClientForm />;
}
