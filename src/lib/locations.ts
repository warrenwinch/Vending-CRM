// Reading locations from the database. Every role can read them (Fillers
// need addresses and access instructions); security rules keep each
// business to its own sites.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { describeCommission, type Location, type LocationStatus } from "@/lib/location-types";
import { formatAud } from "@/lib/au";

// Commission lives in office-only tables (the site's own deal, and its
// client's default); for everyone else they simply come back empty.
const COLUMNS =
  "id, client_id, site_name, address, placement_notes, type, foot_traffic, operating_hours, access_instructions, status, " +
  "clients(company_name, client_commissions(commission_type, commission_rate)), " +
  "location_commissions(commission_type, commission_rate, follows_client)";

type Commission = { commission_type: Location["commission_type"]; commission_rate: number | string | null };
const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
const rate = (v: number | string | null | undefined) => (v == null ? null : Number(v));

type Row = Omit<
  Location,
  | "client_name"
  | "commission_type"
  | "commission_rate"
  | "commission_follows_client"
  | "site_commission_type"
  | "site_commission_rate"
> & {
  clients: { company_name: string; client_commissions: Commission | Commission[] | null } | null;
  location_commissions: (Commission & { follows_client: boolean }) | (Commission & { follows_client: boolean })[] | null;
};

function toLocation({ clients, location_commissions, ...row }: Row): Location {
  const site = one(location_commissions);
  const client = one(clients?.client_commissions);
  // No row yet means the site has never had its own deal: it follows the client.
  const follows = site?.follows_client ?? true;
  const applies = follows ? client : site;
  return {
    ...row,
    commission_type: applies?.commission_type ?? "none",
    commission_rate: rate(applies?.commission_rate),
    commission_follows_client: follows,
    site_commission_type: site && !site.follows_client ? site.commission_type : "none",
    site_commission_rate: site && !site.follows_client ? rate(site.commission_rate) : null,
    client_name: clients?.company_name ?? null,
  };
}

export async function listLocations({
  clientId,
  status,
  search,
}: {
  clientId?: string;
  status?: LocationStatus;
  search?: string;
}) {
  const supabase = await createClient();
  let query = supabase.from("locations").select(COLUMNS).order("site_name");
  if (clientId) query = query.eq("client_id", clientId);
  if (status) query = query.eq("status", status);
  if (search) {
    const term = search.replace(/[%_\\,()]/g, (c) => `\\${c}`);
    query = query.or(`site_name.ilike.%${term}%,address.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load locations: ${error.message}`);
  return (data as unknown as Row[]).map(toLocation);
}

export async function getLocation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("locations").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this location: ${error.message}`);
  return data ? toLocation(data as unknown as Row) : null;
}

// Sites a machine can be placed at (not lost), for the "where to?" drop-down.
// Client names only come back for Administrators and Managers.
export async function listPlaceableLocations() {
  const locations = await listLocations({});
  return locations
    .filter((l) => l.status !== "lost")
    .map((l) => ({
      value: l.id,
      label: [l.site_name, l.client_name].filter(Boolean).join(" — "),
    }));
}

// Names for the "which client?" drop-down on the location form.
export async function listClientOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, client_commissions(commission_type, commission_rate)")
    .order("company_name");
  if (error) throw new Error(`Could not load customers: ${error.message}`);
  return (data as unknown as { id: string; company_name: string; client_commissions: Commission | Commission[] | null }[]).map(
    (c) => {
      const d = one(c.client_commissions);
      // Described for "Same as client (10% of sales)" on the site form.
      const commission = describeCommission(d?.commission_type ?? "none", rate(d?.commission_rate), formatAud);
      return { value: c.id, label: c.company_name, commission };
    },
  );
}
