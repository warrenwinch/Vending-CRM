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
