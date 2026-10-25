// The people in a business, and open invitations. Security rules let
// everyone see their colleagues; only Administrators see invitations.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth-types";
import { roleLabels } from "@/lib/auth";

export type Member = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  active: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
  expires_at: string;
};

export async function listMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, active")
    .order("active", { ascending: false })
    .order("full_name");
  if (error) throw new Error(`Could not load your team: ${error.message}`);
  return data as Member[];
}

// People a site's maintenance can be given to: active members, plus `keep`
// (whoever has it now) so a saved choice never silently disappears.
export async function listAssigneeOptions({ keep }: { keep?: string | null } = {}) {
  const members = await listMembers();
  return members
    .filter((m) => m.active || m.id === keep)
    .map((m) => ({ value: m.id, label: `${m.full_name} (${roleLabels[m.role]})` }));
}

// Invitations not yet accepted or cancelled, including expired ones so they can be re-sent.
export async function listOpenInvitations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, full_name, role, created_at, expires_at")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load invitations: ${error.message}`);
  return data as Invitation[];
}
