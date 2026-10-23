// Reading contacts from the database. Security rules limit them to
// Administrators and Managers in the same business.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/contact-types";

const COLUMNS =
  "id, client_id, location_id, full_name, role_title, phone, email, is_main_contact, notes, locations(site_name)";

type Row = Omit<Contact, "site_name"> & { locations: { site_name: string } | null };

const toContact = ({ locations, ...row }: Row): Contact => ({
  ...row,
  site_name: locations?.site_name ?? null,
});

// Main contact first, then by name.
export async function listContacts({ clientId, locationId }: { clientId?: string; locationId?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select(COLUMNS)
    .order("is_main_contact", { ascending: false })
    .order("full_name");
  if (clientId) query = query.eq("client_id", clientId);
  if (locationId) query = query.eq("location_id", locationId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load contacts: ${error.message}`);
  return (data as unknown as Row[]).map(toContact);
}

export async function getContact(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this contact: ${error.message}`);
  return data ? toContact(data as unknown as Row) : null;
}
