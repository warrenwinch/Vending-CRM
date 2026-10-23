// Reading locations from the database. Every role can read them (Fillers
// need addresses and access instructions); security rules keep each
// business to its own sites.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Location, LocationStatus } from "@/lib/location-types";

const COLUMNS =
  "id, client_id, site_name, address, placement_notes, type, foot_traffic, operating_hours, " +
  "access_instructions, status, commission_type, commission_rate, clients(company_name)";

type Row = Omit<Location, "client_name" | "commission_rate"> & {
  commission_rate: number | string | null;
  clients: { company_name: string } | null;
};

function toLocation({ clients, ...row }: Row): Location {
  return {
    ...row,
    commission_rate: row.commission_rate === null ? null : Number(row.commission_rate),
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
