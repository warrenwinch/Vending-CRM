import Link from "next/link";
import { formatDate } from "@/lib/au";
import { describeEvery, dueState, type Plan } from "@/lib/maintenance";

const tint = {
  overdue: "border-red-600 bg-red-50 hover:bg-red-100",
  soon: "border-amber-500 bg-amber-50 hover:bg-amber-100",
  later: "border-transparent hover:bg-brand-soft",
};

export function DueBadge({ nextDue, today }: { nextDue: string; today: string }) {
  const state = dueState(nextDue, today);
  const style = { overdue: "bg-red-100 text-red-900", soon: "bg-amber-100 text-amber-900", later: "bg-zinc-100 text-zinc-700" }[state];
  const text = state === "overdue" ? `Overdue since ${formatDate(nextDue)}` : nextDue === today ? "Due today" : `Due ${formatDate(nextDue)}`;
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${style}`}>{text}</span>;
}

// Regular jobs, soonest first. Overdue rows are red, due within a week amber.
export function PlanList({
  plans,
  today,
  showMachine,
  empty,
}: {
  plans: Plan[];
  today: string;
  showMachine: boolean;
  empty: string;
}) {
  if (plans.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center text-zinc-500">{empty}</p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
      {plans.map((p) => (
        <li key={p.id}>
          <Link
            href={`/maintenance/${p.id}`}
            className={`flex items-center gap-4 border-l-8 p-4 ${tint[dueState(p.next_due, today)]}`}
          >
            {showMachine && <span className="w-20 shrink-0 font-mono text-sm font-semibold">{p.machine_number}</span>}
            <div className="min-w-0 flex-1">
              {showMachine && (
                <p className={`truncate ${p.site_name ? "font-bold" : "font-medium text-zinc-500"}`}>
                  {p.site_name ?? "In storage"}
                </p>
              )}
              <p className={`truncate ${showMachine ? "text-sm text-zinc-600" : "font-bold"}`}>
                {p.task} <span className="font-normal text-zinc-500">· {describeEvery(p.every_count, p.every_unit).toLowerCase()}</span>
              </p>
              {showMachine && (
                <p className="truncate text-sm text-zinc-500">{p.assigned_name ?? "Nobody assigned"}</p>
              )}
            </div>
            <DueBadge nextDue={p.next_due} today={today} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
