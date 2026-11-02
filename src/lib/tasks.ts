// Reading tasks. The database's rules decide who sees what: Fillers only get
// their own, and customer names only reach Administrators and Managers.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/task-types";

const COLUMNS =
  "id, title, notes, category, priority, due_on, repeats, assigned_to, client_id, location_id, machine_id, done_at, done_by, created_by, " +
  "clients(company_name), locations(site_name), machines(machine_number), " +
  "assignee:profiles!tasks_assigned_to_fkey(full_name), doer:profiles!tasks_done_by_fkey(full_name), " +
  "creator:profiles!tasks_created_by_fkey(full_name)";

type Row = Omit<Task, "client_name" | "site_name" | "machine_number" | "assigned_name" | "done_by_name" | "created_by_name"> & {
  done_by: string | null;
  created_by: string | null;
  clients: { company_name: string } | null;
  locations: { site_name: string } | null;
  machines: { machine_number: string } | null;
  assignee: { full_name: string } | null;
  doer: { full_name: string } | null;
  creator: { full_name: string } | null;
};

const toTask = ({ clients, locations, machines, assignee, doer, creator, done_by, created_by, ...row }: Row): Task => ({
  ...row,
  client_name: clients?.company_name ?? null,
  site_name: locations?.site_name ?? null,
  machine_number: machines?.machine_number ?? null,
  assigned_name: assignee?.full_name ?? null,
  done_by_name: done_by ? (doer?.full_name ?? "Former team member") : null,
  created_by_name: created_by ? (creator?.full_name ?? "Former team member") : null,
});

// Tasks still to do, soonest first, then high priority, with no date last.
export async function listOpenTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(COLUMNS)
    .is("done_at", null)
    .order("due_on", { nullsFirst: false })
    .order("priority")
    .order("created_at")
    .limit(1000);
  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return (data as unknown as Row[]).map(toTask);
}

export async function listDoneTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(COLUMNS)
    .not("done_at", "is", null)
    .order("done_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return (data as unknown as Row[]).map(toTask);
}

export async function getTask(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this task: ${error.message}`);
  return data ? toTask(data as unknown as Row) : null;
}
