import Link from "next/link";
import { Suspense } from "react";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { dueState, listPlans } from "@/lib/maintenance";
import { todayInSydney } from "@/lib/au";
import { PlanList } from "./plan-list";

export default function MaintenancePage({ searchParams }: PageProps<"/maintenance">) {
  return (
    <Suspense
      fallback={
        <>
          <h1 className="page-title">Maintenance</h1>
          <p className="text-sm text-zinc-500">Loading…</p>
        </>
      }
    >
      <Maintenance searchParams={searchParams} />
    </Suspense>
  );
}

async function Maintenance({ searchParams }: Pick<PageProps<"/maintenance">, "searchParams">) {
  const { profile } = await requireProfile();
  const { show, q } = await searchParams;
  const view = show === "all" ? "all" : "due";
  const search = typeof q === "string" ? q.trim() : "";

  const today = todayInSydney();
  const all = await listPlans();
  const overdue = all.filter((p) => dueState(p.next_due, today) === "overdue").length;
  const soon = all.filter((p) => dueState(p.next_due, today) === "soon").length;

  const words = search.toLowerCase();
  const shown = all
    .filter((p) => view === "all" || dueState(p.next_due, today) !== "later")
    .filter(
      (p) =>
        !words ||
        [p.machine_number, p.site_name ?? "", p.task].some((s) => s.toLowerCase().includes(words)),
    );

  const href = (v: string) => {
    const qs = new URLSearchParams();
    if (v === "all") qs.set("show", "all");
    if (search) qs.set("q", search);
    return `/maintenance${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Maintenance</h1>
        {OFFICE_ROLES.includes(profile.role) && (
          <Link href="/maintenance/new" className="btn-primary">
            Add maintenance
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          ["Overdue", overdue, overdue ? "text-red-700" : ""],
          ["Due this week", soon, ""],
          ["Regular jobs", all.length, ""],
        ].map(([label, value, colour]) => (
          <div key={label as string} className="rounded-2xl border-2 border-zinc-200 bg-white p-3">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className={`section-title ${colour}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Show">
          {[
            ["due", `Overdue and this week (${overdue + soon})`],
            ["all", "All"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={href(value)}
              className={`rounded-full px-4 py-2 font-bold ${view === value ? "chip-active" : "chip"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action="/maintenance" className="flex gap-2">
          {view === "all" && <input type="hidden" name="show" value="all" />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Site, machine or job"
            className="input min-w-0 flex-1"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      <PlanList
        plans={shown}
        today={today}
        showMachine
        empty={
          search
            ? "Nothing matches."
            : view === "due"
              ? "Nothing overdue or due this week. Nice."
              : "No regular maintenance set up yet."
        }
      />
    </>
  );
}
