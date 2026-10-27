import Link from "next/link";
import { Suspense } from "react";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { listTags } from "@/lib/tags";
import { EditTagForm, NewTagForm, TagChip } from "../tag-forms";

export default function TagsPage() {
  return (
    <>
      <div>
        <Link href="/machines" className="text-sm font-medium text-zinc-500 underline">
          Machines
        </Link>
        <h1 className="page-title">Tags</h1>
        <p className="mt-1 text-zinc-600">
          Short labels for your machines, like “Cashless” or “Night route”. Add them on a machine&apos;s page, then tap a
          tag on the Machines list to see every machine that has it.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Tags />
      </Suspense>
    </>
  );
}

async function Tags() {
  const { profile } = await requireProfile();
  const isOffice = OFFICE_ROLES.includes(profile.role);
  const tags = await listTags();

  return (
    <>
      <NewTagForm />
      {tags.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          No tags yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
          {tags.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TagChip tag={t} />
                <Link href={`/machines?tag=${t.id}`} className="text-sm font-medium underline">
                  {t.machines} machine{t.machines === 1 ? "" : "s"}
                </Link>
              </div>
              {isOffice && <EditTagForm tag={t} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
