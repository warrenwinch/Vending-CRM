"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { isCommissionType, isLocationStatus, isLocationType } from "@/lib/location-types";
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
  if (!isCommissionType(values.commission_type)) return fail("Please choose a commission type.");

  // Commission: a percentage (0 to 100) or dollars per month. None means no rate.
  let rate: number | null = null;
  if (values.commission_type !== "none") {
    const cleaned = values.commission_rate.replace(/[$,%\s]/g, "");
    rate = Number(cleaned);
    if (!cleaned || !Number.isFinite(rate) || rate < 0) {
      return fail("Please enter the commission as a number, for example 10 or 150.");
    }
    if (values.commission_type === "percentage" && rate > 100) {
      return fail("A percentage commission can't be more than 100.");
    }
    rate = Math.round(rate * 100) / 100;
  }

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
    commission_type: values.commission_type,
    commission_rate: rate,
  };

  const supabase = await createClient();
  const { data, error } = locationId
    ? await supabase.from("locations").update(row).eq("id", locationId).select("id")
    : await supabase.from("locations").insert(row).select("id");

  if (error) return fail(`Could not save: ${error.message}`);
  if (!data?.length) return fail("Could not save this location. It may have been removed.");

  redirect(`/locations/${data[0].id}`);
}
