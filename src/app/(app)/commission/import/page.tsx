import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { createClient } from "@/lib/supabase/server";
import { ImportCommission } from "./import-commission";

export default function ImportCommissionPage() {
  return (
    <>
      <div>
        <Link href="/commission" className="text-sm font-medium text-zinc-500 underline">
          Commission payments
        </Link>
        <h1 className="page-title">Import commission from Seed</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Importer />
      </Suspense>
    </>
  );
}

async function Importer() {
  await requireRole(OFFICE_ROLES);
  const supabase = await createClient();
  const [clients, { data: lines, error }] = await Promise.all([
    listClients({}),
    supabase.from("commission_payment_lines").select("period_start, period_end, commission_payments!inner(client_id)"),
  ]);
  if (error) throw new Error(`Could not load commission payments: ${error.message}`);

  // Customer and period of every payment already recorded, to skip repeats.
  const recorded = (lines as unknown as { period_start: string; period_end: string; commission_payments: { client_id: string } }[]).map(
    (l) => `${l.commission_payments.client_id}|${l.period_start}|${l.period_end}`,
  );

  return (
    <ImportCommission
      clients={clients.map((c) => ({ id: c.id, name: c.company_name }))}
      recorded={recorded}
    />
  );
}
