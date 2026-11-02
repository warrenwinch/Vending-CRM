// The drop-down lists on the add and edit forms.
import "server-only";
import { OFFICE_ROLES, type Role } from "@/lib/auth";
import { listClientOptions, listPlaceableLocations } from "@/lib/locations";
import { listMachineChoices } from "@/lib/maintenance";
import { listAssigneeOptions } from "@/lib/team";
import type { Task } from "@/lib/task-types";
import type { TaskChoices } from "./task-forms";

// `task` is the one being edited: its site and machine stay on the list even
// if they've since been lost or retired, so saving doesn't quietly clear them.
export async function loadTaskChoices(role: Role, task?: Task): Promise<TaskChoices> {
  const isOffice = OFFICE_ROLES.includes(role);
  const [team, clients, sites, machines] = await Promise.all([
    listAssigneeOptions({ keep: task?.assigned_to }),
    isOffice ? listClientOptions({ keep: task?.client_id ?? undefined }) : null,
    listPlaceableLocations(),
    listMachineChoices(),
  ]);
  const machineOptions = machines.map((m) => ({
    value: m.id,
    label: [m.machine_number, m.site ?? "In storage"].join(" — "),
  }));
  if (task?.location_id && task.site_name && !sites.some((s) => s.value === task.location_id)) {
    sites.unshift({ value: task.location_id, label: task.site_name });
  }
  if (task?.machine_id && task.machine_number && !machineOptions.some((m) => m.value === task.machine_id)) {
    machineOptions.unshift({ value: task.machine_id, label: task.machine_number });
  }
  return {
    team,
    clients: clients && clients.map((c) => ({ value: c.value, label: c.label })),
    sites,
    machines: machineOptions,
  };
}
