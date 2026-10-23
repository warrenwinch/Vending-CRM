import { MACHINE_STATUSES, type MachineStatus } from "@/lib/machine-types";

const styles: Record<MachineStatus, string> = {
  in_storage: "bg-sky-100 text-sky-900",
  installed: "bg-leaf-soft text-leaf-deep",
  needs_repair: "bg-red-100 text-red-900",
  retired: "bg-zinc-200 text-zinc-700",
};

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {MACHINE_STATUSES.find((s) => s.value === status)?.label}
    </span>
  );
}
