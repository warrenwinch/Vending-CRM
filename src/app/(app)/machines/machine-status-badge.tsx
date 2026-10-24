import { MACHINE_STATUSES, type MachineStatus } from "@/lib/machine-types";

const styles: Record<MachineStatus, string> = {
  in_storage: "bg-sky-100 text-sky-900",
  installed: "bg-leaf-soft text-leaf-deep",
  needs_repair: "bg-red-100 text-red-900",
  retired: "bg-zinc-200 text-zinc-700",
};

// Whole-row colour so broken and working machines stand out at a glance.
export const machineRowTint: Record<MachineStatus, string> = {
  needs_repair: "border-red-600 bg-red-50 hover:bg-red-100",
  installed: "border-leaf bg-leaf-soft hover:bg-[#e2edc8]",
  in_storage: "border-transparent hover:bg-brand-soft",
  retired: "border-transparent bg-zinc-50 text-zinc-500 hover:bg-zinc-100",
};

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {MACHINE_STATUSES.find((s) => s.value === status)?.label}
    </span>
  );
}
