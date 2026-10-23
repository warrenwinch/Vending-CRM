import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/form-ui";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/auth-types";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/app/auth/actions";
import { JoinForm, SetupForm } from "./setup-form";

export default function SetupPage() {
  return (
    <AuthCard title="Welcome to Vending CRM">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Setup />
      </Suspense>
    </AuthCard>
  );
}

type Invitation = { id: string; organization_name: string; role: string; full_name: string | null };

async function Setup() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: status } = await supabase.rpc("my_account_status");
  if (status === "active") redirect("/");

  if (status === "inactive") {
    return (
      <>
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Your access has been switched off. If you think this is a mistake, ask an Administrator in your business to
          switch it back on.
        </p>
        <form action={logOut}>
          <button type="submit" className="text-sm font-medium underline">
            Log out
          </button>
        </form>
      </>
    );
  }

  // Invitations for this person's (confirmed) email address.
  const { data } = await supabase.rpc("my_invitations");
  const invitations = (data ?? []) as Invitation[];

  return (
    <>
      {invitations.map((inv) => (
        <JoinForm
          key={inv.id}
          invitationId={inv.id}
          businessName={inv.organization_name}
          roleLabel={ROLES.find((r) => r.value === inv.role)?.label ?? inv.role}
          defaultName={user.fullName || inv.full_name || ""}
        />
      ))}

      <details open={invitations.length === 0} className="flex flex-col gap-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {invitations.length ? "Or set up your own business instead" : "Set up your business"}
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;ll be its Administrator and can invite your team later. If you were expecting an invitation, ask
            the person who invited you to check they used {user.email}.
          </p>
          <SetupForm defaultName={user.fullName} />
        </div>
      </details>
    </>
  );
}
