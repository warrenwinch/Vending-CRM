import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/form-ui";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { SetupForm } from "./setup-form";

export default function SetupPage() {
  return (
    <AuthCard title="Set up your business">
      <p className="text-zinc-600 dark:text-zinc-400">
        One last step. You&apos;ll be the Administrator and can invite your team later.
      </p>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Setup />
      </Suspense>
    </AuthCard>
  );
}

async function Setup() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await getProfile(user.id)) redirect("/");
  return <SetupForm defaultName={user.fullName} />;
}
