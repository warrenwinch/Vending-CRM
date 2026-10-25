import { formatDate } from "@/lib/au";
import type { DoneJob } from "@/lib/maintenance";

// Jobs done, newest first, noting any that were done late.
export function DoneList({ jobs, showTask, empty }: { jobs: DoneJob[]; showTask: boolean; empty: string }) {
  if (jobs.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <ol className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white text-sm">
      {jobs.map((j) => (
        <li key={j.id} className="flex flex-col gap-1 p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">
              {showTask && <>{j.task} · </>}
              {formatDate(j.done_on)} by {j.done_by_name}
            </span>
            {j.done_on > j.due_on && <span className="text-amber-800">Due {formatDate(j.due_on)}</span>}
          </div>
          {j.site_name && <span className="text-zinc-500">At {j.site_name}</span>}
          {j.notes && <p className="whitespace-pre-line text-zinc-700">{j.notes}</p>}
        </li>
      ))}
    </ol>
  );
}
