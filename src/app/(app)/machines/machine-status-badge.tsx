import { MACHINE_STATUSES, type MachineStatus } from "@/lib/machine-types";

const styles: Record<MachineStatus, string> = {
  in_storage: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  installed: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  needs_repair: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  retired: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {MACHINE_STATUSES.find((s) => s.value === status)?.label}
    </span>
  );
}
