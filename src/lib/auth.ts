// One place to ask "who is logged in, and which business are they in?"
// The database's security rules still check every request.
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Role = "administrator" | "manager" | "warehouse" | "filler";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
};

export type Profile = {
  fullName: string;
  role: Role;
  organizationName: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: (data.user.user_metadata?.full_name as string | undefined) ?? "",
  };
}

// Null means the person has logged in but not yet set up their business.
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, organizations(trading_name)")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  if (!data) return null;

  const org = data.organizations as unknown as { trading_name: string } | null;
  return {
    fullName: data.full_name,
    role: data.role as Role,
    organizationName: org?.trading_name ?? "",
  };
}

export const roleLabels: Record<Role, string> = {
  administrator: "Administrator",
  manager: "Manager",
  warehouse: "Warehouse",
  filler: "Filler",
};
