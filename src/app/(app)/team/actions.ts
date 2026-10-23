"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { isRole } from "@/lib/auth-types";
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
  await requireRole(["administrator"]);

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

  const { error } = await supabase
    .from("invitations")
    .insert({ email: values.email, full_name: values.full_name || null, role: values.role });
  if (error) return fail(`Could not create the invitation: ${explain(error.message)}`);

  revalidatePath("/team");
  return { message: `Invitation created for ${values.email}. Send them the message shown under “Waiting to join”.` };
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
