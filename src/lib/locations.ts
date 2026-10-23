// Reading locations from the database. Every role can read them (Fillers
// need addresses and access instructions); security rules keep each
// business to its own sites.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Location, LocationStatus } from "@/lib/location-types";

// Commission lives in its own table that only Administrators and Managers
// can read; for everyone else it simply comes back empty.
const COLUMNS =
  "id, client_id, site_name, address, placement_notes, type, foot_traffic, operating_hours, " +
  "access_instructions, status, clients(company_name), location_commissions(commission_type, commission_rate)";

type Commission = { commission_type: Location["commission_type"]; commission_rate: number | string | null };

type Row = Omit<Location, "client_name" | "commission_type" | "commission_rate"> & {
  clients: { company_name: string } | null;
  location_commissions: Commission | Commission[] | null;
};

function toLocation({ clients, location_commissions, ...row }: Row): Location {
  const c = Array.isArray(location_commissions) ? location_commissions[0] : location_commissions;
  return {
    ...row,
    commission_type: c?.commission_type ?? "none",
    commission_rate: c?.commission_rate == null ? null : Number(c.commission_rate),
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
  const { data, error } = await supabase.from("clients").select("id, company_name").order("company_name");
  if (error) throw new Error(`Could not load clients: ${error.message}`);
  return data.map((c) => ({ value: c.id as string, label: c.company_name as string }));
}
