// Reading machines from the database. Every role can read them; security
// rules keep each business to its own machines.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Machine, MachineStatus } from "@/lib/machine-types";
import type { Tag } from "@/lib/tag-types";

const COLUMNS =
  "id, machine_number, manufacturer, model, serial_number, type, payment_hardware, status, purchase_date, public_token";

// Purchase cost lives in its own table that only Administrators and
// Managers can read; for everyone else it simply comes back empty.
type Cost = { purchase_cost: number | string | null };
type Row = Omit<Machine, "purchase_cost"> & { machine_costs?: Cost | Cost[] | null };

const toMachine = ({ machine_costs, ...row }: Row): Machine => {
  const c = Array.isArray(machine_costs) ? machine_costs[0] : machine_costs;
  return { ...row, purchase_cost: c?.purchase_cost == null ? null : Number(c.purchase_cost) };
};

type ListRow = Row & {
  machine_placements: { position: string | null; locations: { site_name: string } | null }[];
  machine_tags: { tags: Tag | null }[];
};

// Machines with a tag whose name matches (e.g. "cash" finds "Cashless").
async function machinesTaggedLike(term: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("machine_tags").select("machine_id, tags!inner(name)").ilike("tags.name", `%${term}%`);
  return (data ?? []).map((r) => r.machine_id as string);
}

// Machines now at a site whose name or address matches (e.g. "ABS House",
// "George St"), or whose position on site matches (e.g. "Level 4").
async function machinesAtSitesMatching(term: string) {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("locations")
    .select("id")
    .or(`site_name.ilike.%${term}%,address.ilike.%${term}%`);
  const siteIds = (sites ?? []).map((s) => s.id as string);

  const { data: placements } = await supabase
    .from("machine_placements")
    .select("machine_id")
    .is("ended_on", null)
    .or([`position.ilike.%${term}%`, ...(siteIds.length ? [`location_id.in.(${siteIds.join(",")})`] : [])].join(","));
  return [...new Set((placements ?? []).map((p) => p.machine_id as string))];
}

// tagIds: only machines that have every one of these tags.
export async function listMachines({
  status,
  search,
  tagIds = [],
}: {
  status?: MachineStatus;
  search?: string;
  tagIds?: string[];
}) {
  const supabase = await createClient();
  // Newest first: numbers go VM-999, VM-1000, so sorting the text would mix them up.
  // Only the open placement (no end date) is fetched: where each machine is now.
  let query = supabase
    .from("machines")
    .select(`${COLUMNS}, machine_placements(position, locations(site_name)), machine_tags(tags(id, name, colour))`)
    .is("machine_placements.ended_on", null)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (search) {
    const term = search.replace(/[%_\\,()]/g, (c) => `\\${c}`);
    const [atMatchingSites, tagged] = await Promise.all([machinesAtSitesMatching(term), machinesTaggedLike(term)]);
    const ids = [...new Set([...atMatchingSites, ...tagged])];
    query = query.or(
      [
        `machine_number.ilike.%${term}%`,
        `serial_number.ilike.%${term}%`,
        `manufacturer.ilike.%${term}%`,
        `model.ilike.%${term}%`,
        ...(ids.length ? [`id.in.(${ids.join(",")})`] : []),
      ].join(","),
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load machines: ${error.message}`);
  return (data as unknown as ListRow[])
    .map(({ machine_placements, machine_tags, ...row }) => {
      const here = machine_placements[0];
      const site = here?.locations?.site_name;
      return {
        ...toMachine(row),
        // "ABS House, Level 4N"
        site_name: site ? [site, here.position].filter(Boolean).join(", ") : null,
        // The same, kept apart so lists can show the position on its own line.
        site: site ?? null,
        position: site ? here.position : null,
        tags: machine_tags
          .map((t) => t.tags)
          .filter((t): t is Tag => Boolean(t))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .filter((m) => tagIds.every((id) => m.tags.some((t) => t.id === id)));
}

export async function getMachine(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machines")
    .select(`${COLUMNS}, machine_costs(purchase_cost)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load this machine: ${error.message}`);
  return data ? toMachine(data as unknown as Row) : null;
}
