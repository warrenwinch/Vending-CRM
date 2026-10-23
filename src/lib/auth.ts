// One place to ask "who is logged in, and which business are they in?"
// The database's security rules still check every request.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
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

// cache() means several parts of one page can ask without extra trips to the database.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: (data.user.user_metadata?.full_name as string | undefined) ?? "",
  };
});

// Null means the person has logged in but not yet set up their business.
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
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
});

// For pages: logged in and set up, or off to the right page.
export async function requireProfile() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/setup");
  return { user, profile };
}

// For pages only some roles may use. Hides the screen; the database is the real lock.
export async function requireRole(roles: Role[]) {
  const session = await requireProfile();
  if (!roles.includes(session.profile.role)) redirect("/");
  return session;
}

export const OFFICE_ROLES: Role[] = ["administrator", "manager"];

export const roleLabels: Record<Role, string> = {
  administrator: "Administrator",
  manager: "Manager",
  warehouse: "Warehouse",
  filler: "Filler",
};
