// Coloured status pill used by clients and locations (both prospect / active / lost).
const styles = {
  prospect: "bg-amber-100 text-amber-900",
  active: "bg-leaf-soft text-leaf-deep",
  lost: "bg-zinc-200 text-zinc-700",
};

const labels = { prospect: "Prospect", active: "Active", lost: "Lost" };

export function StatusBadge({ status }: { status: keyof typeof styles }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
