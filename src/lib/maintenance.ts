// Regular maintenance: each machine's plans (what, how often, next due)
// and the history of jobs done. Everyone in the business can see them.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MachineStatus } from "@/lib/machine-types";

export type MaintenanceUnit = "weeks" | "months";

export type Plan = {
  id: string;
  machine_id: string;
  task: string;
  every_count: number;
  every_unit: MaintenanceUnit;
  next_due: string;
  notes: string | null;
  machine_number: string;
  machine_status: MachineStatus;
  location_id: string | null;
  site_name: string | null; // with the position, e.g. "ABS House, Level 4N"
};

export type DoneJob = {
  id: string;
  plan_id: string | null;
  task: string;
  due_on: string;
  done_on: string;
  notes: string | null;
  done_by_name: string;
  site_name: string | null;
};

// A starting list; any other job can be typed in.
export const SUGGESTED_TASKS = ["Full clean, inside and out", "Glass and front clean"];

export const describeEvery = (count: number, unit: MaintenanceUnit) =>
  count === 1 ? `Every ${unit === "weeks" ? "week" : "month"}` : `Every ${count} ${unit}`;

// Overdue, due within a week, or later.
export function dueState(nextDue: string, today: string): "overdue" | "soon" | "later" {
  if (nextDue < today) return "overdue";
  const weekAhead = new Date(`${today}T00:00:00Z`);
  weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
  return nextDue <= weekAhead.toISOString().slice(0, 10) ? "soon" : "later";
}

const PLAN_COLUMNS =
  "id, machine_id, task, every_count, every_unit, next_due, notes, " +
  "machines(machine_number, status, machine_placements(location_id, position, ended_on, locations(site_name)))";

type PlanRow = Omit<Plan, "machine_number" | "machine_status" | "location_id" | "site_name"> & {
  machines: {
    machine_number: string;
    status: MachineStatus;
    machine_placements: {
      location_id: string;
      position: string | null;
      ended_on: string | null;
      locations: { site_name: string } | null;
    }[];
  } | null;
};

function toPlan({ machines, ...row }: PlanRow): Plan {
  const here = machines?.machine_placements.find((p) => p.ended_on === null);
  return {
    ...row,
    machine_number: machines?.machine_number ?? "Unknown machine",
    machine_status: machines?.status ?? "in_storage",
    location_id: here?.location_id ?? null,
    site_name: here?.locations ? [here.locations.site_name, here.position].filter(Boolean).join(", ") : null,
  };
}

// Soonest due first. Retired machines are left out unless asking about one machine.
export async function listPlans({ machineId }: { machineId?: string } = {}) {
  const supabase = await createClient();
  let query = supabase.from("maintenance_plans").select(PLAN_COLUMNS).order("next_due");
  if (machineId) query = query.eq("machine_id", machineId);
  const { data, error } = await query.limit(2000);
  if (error) throw new Error(`Could not load maintenance: ${error.message}`);
  const plans = (data as unknown as PlanRow[]).map(toPlan);
  return machineId ? plans : plans.filter((p) => p.machine_status !== "retired");
}

export async function getPlan(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("maintenance_plans").select(PLAN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this maintenance job: ${error.message}`);
  return data ? toPlan(data as unknown as PlanRow) : null;
}

// Newest first.
export async function listDone({ machineId, planId, limit = 50 }: { machineId?: string; planId?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("maintenance_done")
    .select(
      "id, plan_id, task, due_on, done_on, notes, locations(site_name), " +
        "doer:profiles!maintenance_done_done_by_fkey(full_name)",
    )
    .order("done_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (machineId) query = query.eq("machine_id", machineId);
  if (planId) query = query.eq("plan_id", planId);
  const { data, error } = await query.limit(limit);
  if (error) throw new Error(`Could not load maintenance history: ${error.message}`);
  type Row = Omit<DoneJob, "done_by_name" | "site_name"> & {
    locations: { site_name: string } | null;
    doer: { full_name: string } | null;
  };
  return (data as unknown as Row[]).map(({ locations, doer, ...row }) => ({
    ...row,
    site_name: locations?.site_name ?? null,
    done_by_name: doer?.full_name ?? "Former team member",
  }));
}

export type MachineChoice = { id: string; machine_number: string; site: string | null; position: string | null };

// Machines a plan can be added to (not retired), grouped by site in the form.
export async function listMachineChoices(): Promise<MachineChoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machines")
    .select("id, machine_number, machine_placements(position, ended_on, locations(site_name))")
    .neq("status", "retired")
    .limit(2000);
  if (error) throw new Error(`Could not load machines: ${error.message}`);
  type Row = {
    id: string;
    machine_number: string;
    machine_placements: { position: string | null; ended_on: string | null; locations: { site_name: string } | null }[];
  };
  return (data as unknown as Row[])
    .map((m) => {
      const here = m.machine_placements.find((p) => p.ended_on === null);
      return { id: m.id, machine_number: m.machine_number, site: here?.locations?.site_name ?? null, position: here?.position ?? null };
    })
    .sort(
      (a, b) =>
        (a.site ?? "￿").localeCompare(b.site ?? "￿") ||
        a.machine_number.localeCompare(b.machine_number, undefined, { numeric: true }),
    );
}
