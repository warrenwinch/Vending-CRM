"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ROLES, isRole } from "@/lib/auth-types";
import { sendEmail } from "@/lib/alerts";
import { SITE_URL } from "@/lib/qr";
import { formatDate } from "@/lib/au";
import { isUuid } from "@/lib/ids";
import type { FormState } from "@/components/form-ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Friendlier wording for the database's own safety messages.
function explain(message: string) {
  if (message.includes("at least one active Administrator")) {
    return "Your business needs at least one active Administrator. Make someone else an Administrator first.";
  }
  if (message.includes("one_open_invitation_per_email")) {
    return "That email already has an open invitation. Cancel it first if you want to change the role.";
  }
  return message;
}

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireRole(["administrator"]);

  const values = {
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? ""),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!EMAIL.test(values.email)) return fail("Please enter their email address.");
  if (!isRole(values.role)) return fail("Please choose a role.");

  const supabase = await createClient();

  const { data: existing } = await supabase.from("profiles").select("full_name").eq("email", values.email).maybeSingle();
  if (existing) return fail(`${existing.full_name} is already in your team.`);

  const { data: created, error } = await supabase
    .from("invitations")
    .insert({ email: values.email, full_name: values.full_name || null, role: values.role })
    .select("email, full_name, role, expires_at")
    .single();
  if (error) return fail(`Could not create the invitation: ${explain(error.message)}`);

  const sent = await emailInvitation(created, profile.organizationName, profile.fullName);
  revalidatePath("/team");
  return sent.ok
    ? { message: `Invitation emailed to ${values.email}.` }
    : {
        message: `Invitation created for ${values.email}, but the email couldn't be sent. Copy the message under “Waiting to join” and send it yourself.`,
      };
}

type InviteDetails = { email: string; full_name: string | null; role: string; expires_at: string };

// The invitation email: who invited them, their role, and a button to sign up
// with the invited address already filled in.
async function emailInvitation(inv: InviteDetails, businessName: string, inviterName: string) {
  const role = ROLES.find((r) => r.value === inv.role);
  const result = await sendEmail({
    to: [inv.email],
    subject: `You're invited to join ${businessName}`,
    intro: `${inv.full_name ? `Hi ${inv.full_name.split(" ")[0]}, ` : ""}${inviterName} has invited you to the ${businessName} team on Watwin CRM.`,
    lines: [
      ["Your role", role ? `${role.label}: ${role.description}` : inv.role],
      ["Sign up with", inv.email],
      ["Invitation lasts until", formatDate(inv.expires_at.slice(0, 10))],
      ["What to do", "1. Create your account with the button below.\n2. Click the link in the confirmation email.\n3. Click “Join” on the page that opens."],
    ],
    button: { label: "Create your account", href: `${SITE_URL}/signup?email=${encodeURIComponent(inv.email)}` },
  });
  return { ok: !result.skipped && result.ok };
}

// Sends the invitation email again (e.g. it went to spam, or was deleted).
export async function resendInvitation(invitationId: string): Promise<FormState> {
  const { profile } = await requireRole(["administrator"]);
  if (!isUuid(invitationId)) return { error: "That invitation wasn't found." };

  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("email, full_name, role, expires_at")
    .eq("id", invitationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (!inv) return { error: "That invitation is no longer open." };
  if (inv.expires_at < new Date().toISOString()) return { error: "This invitation has expired. Cancel it and invite them again." };

  const sent = await emailInvitation(inv, profile.organizationName, profile.fullName);
  return sent.ok
    ? { message: `Sent again to ${inv.email}.` }
    : { error: "The email couldn't be sent. Copy the message below and send it yourself." };
}

export async function cancelInvitation(invitationId: string) {
  await requireRole(["administrator"]);
  if (!isUuid(invitationId)) return;
  const supabase = await createClient();
  await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitationId);
  revalidatePath("/team");
}

// Changes someone's role, or switches their access off or back on.
export async function updateMember(memberId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireRole(["administrator"]);
  if (!isUuid(memberId)) return { error: "That person wasn't found." };

  const role = String(formData.get("role") ?? "");
  const active = formData.get("active") === "on";
  if (!isRole(role)) return { error: "Please choose a role." };
  if (memberId === user.id && (role !== "administrator" || !active)) {
    return { error: "You can't remove your own Administrator access. Ask another Administrator to do it." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ role, active }).eq("id", memberId).select("id");
  if (error) return { error: explain(error.message) };
  if (!data.length) return { error: "That person wasn't found." };

  revalidatePath("/team");
  return { message: "Saved." };
}
