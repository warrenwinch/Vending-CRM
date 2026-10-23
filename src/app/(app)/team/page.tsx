import { Suspense } from "react";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/auth-types";
import { listMembers, listOpenInvitations, type Invitation } from "@/lib/team";
import { formatDate } from "@/lib/au";
import { cancelInvitation } from "./actions";
import { CopyInvite, InviteForm, MemberForm } from "./team-forms";

export default function TeamPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Team />
      </Suspense>
    </>
  );
}

const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

// The website address people should sign up at (this same site).
async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function inviteMessage(inv: Invitation, businessName: string, site: string) {
  const greeting = inv.full_name ? `Hi ${inv.full_name.split(" ")[0]},` : "Hi,";
  return [
    greeting,
    "",
    `You've been invited to join ${businessName} on Vending CRM as ${roleLabel(inv.role)}.`,
    "",
    `1. Create your account here, using this email address (${inv.email}):`,
    `   ${site}/signup?email=${encodeURIComponent(inv.email)}`,
    "2. Click the confirmation link we email you.",
    "3. Click “Join” on the page that opens.",
    "",
    `This invitation lasts until ${formatDate(inv.expires_at.slice(0, 10))}.`,
  ].join("\n");
}

async function Team() {
  const { user, profile } = await requireRole(["administrator"]);
  const [members, invitations, site] = await Promise.all([listMembers(), listOpenInvitations(), siteUrl()]);
  const now = new Date().toISOString();

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">People</h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {m.full_name}
                  {!m.active && (
                    <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Switched off
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-zinc-500">{m.email}</p>
              </div>
              <MemberForm memberId={m.id} role={m.role} active={m.active} isMe={m.id === user.id} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          Switching someone off stops them logging in straight away. Their history stays. You can switch them back on later.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Invite someone</h2>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <InviteForm />
        </div>
      </section>

      {invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Waiting to join</h2>
          <p className="text-sm text-zinc-500">
            Send each person their message by email or text. They join once they sign up with that email address.
          </p>
          <ul className="flex flex-col gap-4">
            {invitations.map((inv) => {
              const expired = inv.expires_at < now;
              return (
                <li key={inv.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {inv.full_name ?? inv.email} · {roleLabel(inv.role)}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {inv.email} · invited {formatDate(inv.created_at.slice(0, 10))}
                        {expired && <span className="font-medium text-red-700 dark:text-red-300"> · expired</span>}
                      </p>
                    </div>
                    <form action={cancelInvitation.bind(null, inv.id)}>
                      <button type="submit" className="text-sm font-medium text-red-700 underline dark:text-red-300">
                        Cancel invitation
                      </button>
                    </form>
                  </div>
                  {expired ? (
                    <p className="text-sm text-zinc-500">This invitation has expired. Cancel it and invite them again.</p>
                  ) : (
                    <CopyInvite text={inviteMessage(inv, profile.organizationName, site)} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
