"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-ui";

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!businessName || !fullName) return { error: "Please fill in both fields." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  // The database makes the organization and makes this person its Administrator.
  const { error } = await supabase.rpc("create_organization", {
    p_trading_name: businessName,
    p_full_name: fullName,
    p_email: data.user.email ?? "",
  });

  if (error) {
    if (error.message.includes("already belongs")) redirect("/");
    return { error: `Something went wrong setting up your business: ${error.message}` };
  }

  redirect("/");
}

// Joins the business that invited this person, with the role it chose.
export async function acceptInvitation(
  invitationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Please enter your name." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { error } = await supabase.rpc("accept_invitation", {
    p_invitation_id: invitationId,
    p_full_name: fullName,
  });

  if (error) {
    if (error.message.includes("already belongs")) redirect("/");
    if (error.message.includes("no longer available")) {
      return { error: "This invitation has been cancelled or has expired. Ask your Administrator to invite you again." };
    }
    return { error: `Something went wrong joining: ${error.message}` };
  }

  redirect("/");
}
