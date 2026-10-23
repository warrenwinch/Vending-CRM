import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfile, roleLabels } from "@/lib/auth";
import { logOut } from "@/app/auth/actions";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile) redirect("/setup");

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">{profile.organizationName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {profile.fullName}</h1>
        </div>
        <form action={logOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Log out
          </button>
        </form>
      </header>

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

      <p className="text-zinc-600 dark:text-zinc-400">
        Clients, locations and machines are coming next.
      </p>
    </>
  );
}
