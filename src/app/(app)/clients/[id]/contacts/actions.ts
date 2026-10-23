"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import type { FormState } from "@/components/form-ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Saves a new contact (contactId null) or changes an existing one.
export async function saveContact(
  clientId: string,
  contactId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(OFFICE_ROLES);

  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    full_name: get("full_name"),
    role_title: get("role_title"),
    phone: get("phone"),
    email: get("email").toLowerCase(),
    location_id: get("location_id"),
    is_main_contact: formData.get("is_main_contact") === "on" ? "on" : "",
    notes: get("notes"),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(clientId)) return fail("This client wasn't found.");
  if (!values.full_name) return fail("Please enter the contact's name.");
  if (values.email && !EMAIL.test(values.email)) return fail("Please check the email address.");
  if (values.location_id && !isUuid(values.location_id)) return fail("Please choose a site from the list.");

  const isMain = values.is_main_contact === "on";
  const row = {
    client_id: clientId,
    location_id: values.location_id || null,
    full_name: values.full_name,
    role_title: values.role_title || null,
    phone: values.phone || null,
    email: values.email || null,
    is_main_contact: isMain,
    notes: values.notes || null,
  };

  const supabase = await createClient();

  // The site must be one of this client's sites.
  if (row.location_id) {
    const { data: site } = await supabase
      .from("locations")
      .select("id")
      .eq("id", row.location_id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!site) return fail("That site doesn't belong to this client. Please choose another.");
  }

  // Each client has one main contact: making this one main un-marks the others.
  if (isMain) {
    let others = supabase.from("contacts").update({ is_main_contact: false }).eq("client_id", clientId).eq("is_main_contact", true);
    if (contactId) others = others.neq("id", contactId);
    const { error } = await others;
    if (error) return fail(`Could not save: ${error.message}`);
  }

  const { data, error } = contactId
    ? await supabase.from("contacts").update(row).eq("id", contactId).eq("client_id", clientId).select("id")
    : await supabase.from("contacts").insert(row).select("id");

  if (error) return fail(`Could not save: ${error.message}`);
  if (!data?.length) return fail("Could not save this contact. It may have been removed.");

  redirect(`/clients/${clientId}`);
}

export async function deleteContact(clientId: string, contactId: string) {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(clientId) || !isUuid(contactId)) return;
  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", contactId).eq("client_id", clientId);
  redirect(`/clients/${clientId}`);
}
