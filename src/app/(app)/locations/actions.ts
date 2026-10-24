"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { isCommissionType, isLocationStatus, isLocationType, parseCommissionRate } from "@/lib/location-types";
import type { FormState } from "@/components/form-ui";

// Saves a new location (locationId null) or changes an existing one.
export async function saveLocation(
  locationId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(OFFICE_ROLES);

  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    client_id: get("client_id"),
    site_name: get("site_name"),
    address: get("address"),
    placement_notes: get("placement_notes"),
    type: get("type"),
    foot_traffic: get("foot_traffic"),
    operating_hours: get("operating_hours"),
    access_instructions: get("access_instructions"),
    status: get("status"),
    commission_type: get("commission_type"),
    commission_rate: get("commission_rate"),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(values.client_id)) return fail("Please choose which client this site belongs to.");
  if (!values.site_name) return fail("Please enter the site name.");
  if (!isLocationType(values.type)) return fail("Please choose the type of site.");
  if (!isLocationStatus(values.status)) return fail("Please choose a status.");
  // "client" = use the client's default; otherwise the site's own deal.
  const followsClient = values.commission_type === "client";
  const ownType = followsClient ? "none" : values.commission_type;
  if (!isCommissionType(ownType)) return fail("Please choose the commission.");
  const parsed = parseCommissionRate(ownType, values.commission_rate);
  if ("error" in parsed) return fail(parsed.error);

  const row = {
    client_id: values.client_id,
    site_name: values.site_name,
    address: values.address || null,
    placement_notes: values.placement_notes || null,
    type: values.type,
    foot_traffic: values.foot_traffic || null,
    operating_hours: values.operating_hours || null,
    access_instructions: values.access_instructions || null,
    status: values.status,
  };

  const supabase = await createClient();
  const { data, error } = locationId
    ? await supabase.from("locations").update(row).eq("id", locationId).select("id")
    : await supabase.from("locations").insert(row).select("id");

  if (error) return fail(`Could not save: ${error.message}`);
  if (!data?.length) return fail("Could not save this location. It may have been removed.");
  const savedId = data[0].id as string;

  // Commission is kept in its own table, private to Administrators and Managers.
  const { error: commissionError } = await supabase
    .from("location_commissions")
    .upsert(
      { location_id: savedId, follows_client: followsClient, commission_type: ownType, commission_rate: parsed.rate },
      { onConflict: "location_id" },
    );
  if (commissionError) {
    // The site itself is saved; say so, so it isn't added a second time.
    return {
      error: `The site was saved, but its commission wasn't (${commissionError.message}). Don't save this form again: open the site from Locations and edit its commission there.`,
      values,
    };
  }

  redirect(`/locations/${savedId}`);
}

// Deletes a site, but only if nothing in its history depends on it.
// Sites with machines, faults or commission payments should be set to Lost instead.
export async function deleteLocation(locationId: string): Promise<FormState> {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(locationId)) return { error: "This location wasn't found." };

  const supabase = await createClient();
  const howMany = { count: "exact", head: true } as const;
  const [placements, faults, payments] = await Promise.all([
    supabase.from("machine_placements").select("id", howMany).eq("location_id", locationId),
    supabase.from("machine_faults").select("id", howMany).eq("location_id", locationId),
    supabase.from("commission_payment_lines").select("id", howMany).eq("location_id", locationId),
  ]);

  const reasons = [
    placements.count ? "machines have been placed there" : null,
    faults.count ? "faults have been logged there" : null,
    payments.count ? "commission has been paid for it" : null,
  ].filter(Boolean);
  if (reasons.length) {
    return {
      error: `This site can't be deleted because ${reasons.join(", and ")}, and that history must be kept. Set its status to Lost instead: it then drops out of the active lists.`,
    };
  }

  const { data: site } = await supabase.from("locations").select("client_id").eq("id", locationId).maybeSingle();

  // Keep the people: the database would delete this site's contacts with it,
  // so move them to "All sites" for the client first.
  const { error: contactsError } = await supabase.from("contacts").update({ location_id: null }).eq("location_id", locationId);
  if (contactsError) return { error: `Could not move this site's contacts: ${contactsError.message}` };

  // Its notes and commission setting go with it.
  const { error } = await supabase.from("locations").delete().eq("id", locationId);
  if (error) return { error: `Could not delete this site: ${error.message}` };

  redirect(site?.client_id ? `/clients/${site.client_id}` : "/locations");
}
