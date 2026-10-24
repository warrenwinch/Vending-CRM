// Reading clients from the database. Security rules limit this to the
// logged-in person's business, and to Administrators and Managers.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Client, ClientStatus } from "@/lib/client-types";

const COLUMNS =
  "id, company_name, abn, billing_contact, billing_email, billing_phone, gst_registered, status, " +
  "client_commissions(commission_type, commission_rate)";

type Commission = { commission_type: Client["commission_type"]; commission_rate: number | string | null };
type Row = Omit<Client, "commission_type" | "commission_rate"> & {
  client_commissions: Commission | Commission[] | null;
};

// The default commission lives in its own office-only table.
const toClient = ({ client_commissions, ...row }: Row): Client => {
  const c = Array.isArray(client_commissions) ? client_commissions[0] : client_commissions;
  return {
    ...row,
    commission_type: c?.commission_type ?? "none",
    commission_rate: c?.commission_rate == null ? null : Number(c.commission_rate),
  };
};

export async function listClients({ status, search }: { status?: ClientStatus; search?: string }) {
  const supabase = await createClient();
  let query = supabase.from("clients").select(COLUMNS).order("company_name");
  if (status) query = query.eq("status", status);
  if (search) {
    // Escape the characters the search syntax treats specially.
    const term = search.replace(/[%_\\,()]/g, (c) => `\\${c}`);
    query = query.or(`company_name.ilike.%${term}%,billing_contact.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load clients: ${error.message}`);
  return (data as unknown as Row[]).map(toClient);
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this client: ${error.message}`);
  return data ? toClient(data as unknown as Row) : null;
}
