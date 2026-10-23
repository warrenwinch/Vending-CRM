import { Suspense } from "react";
import { requireProfile, roleLabels } from "@/lib/auth";

export default function Home() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { user, profile } = await requireProfile();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {profile.fullName}</h1>

      <dl className="grid gap-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Email</dt>
          <dd className="break-all text-right">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Role</dt>
          <dd>{roleLabels[profile.role]}</dd>
        </div>
      </dl>

    </>
  );
}
