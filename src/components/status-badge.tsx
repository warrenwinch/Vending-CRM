// Coloured status pill used by clients and locations (both prospect / active / lost).
const styles = {
  prospect: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  active: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  lost: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const labels = { prospect: "Prospect", active: "Active", lost: "Lost" };

export function StatusBadge({ status }: { status: keyof typeof styles }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
