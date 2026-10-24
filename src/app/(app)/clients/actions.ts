"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isClientStatus } from "@/lib/client-types";
import { isCommissionType, parseCommissionRate } from "@/lib/location-types";
import { digitsOnly, isValidAbn } from "@/lib/au";
import { isUuid } from "@/lib/ids";
import type { FormState } from "@/components/form-ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Saves a new client (clientId null) or changes an existing one.
export async function saveClient(
  clientId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(OFFICE_ROLES);

  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    company_name: get("company_name"),
    abn: get("abn"),
    billing_contact: get("billing_contact"),
    billing_email: get("billing_email"),
    billing_phone: get("billing_phone"),
    gst_registered: formData.get("gst_registered") === "on" ? "on" : "",
    status: get("status"),
    commission_type: get("commission_type"),
    commission_rate: get("commission_rate"),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!values.company_name) return fail("Please enter the company name.");

  const abn = digitsOnly(values.abn);
  if (values.abn && abn.length !== 11) return fail("An ABN has 11 digits. Please check it.");
  if (abn && !isValidAbn(abn)) return fail("That ABN doesn't look right. Please check the digits.");

  if (values.billing_email && !EMAIL.test(values.billing_email)) {
    return fail("Please check the billing email address.");
  }
  if (!isClientStatus(values.status)) return fail("Please choose a status.");
  if (!isCommissionType(values.commission_type)) return fail("Please choose the commission.");
  const commission = parseCommissionRate(values.commission_type, values.commission_rate);
  if ("error" in commission) return fail(commission.error);

  const row = {
    company_name: values.company_name,
    abn: abn || null,
    billing_contact: values.billing_contact || null,
    billing_email: values.billing_email.toLowerCase() || null,
    billing_phone: values.billing_phone || null,
    gst_registered: values.gst_registered === "on",
    status: values.status,
  };

  const supabase = await createClient();
  const { data, error } = clientId
    ? await supabase.from("clients").update(row).eq("id", clientId).select("id")
    : await supabase.from("clients").insert(row).select("id");

  if (error) return fail(`Could not save: ${error.message}`);
  // No row back means it wasn't found, or this login isn't allowed to change it.
  if (!data?.length) return fail("Could not save this customer. It may have been removed.");

  const savedId = data[0].id as string;

  // The default commission is kept in its own office-only table.
  const { error: commissionError } = await supabase
    .from("client_commissions")
    .upsert(
      { client_id: savedId, commission_type: values.commission_type, commission_rate: commission.rate },
      { onConflict: "client_id" },
    );
  if (commissionError) {
    // The client itself is saved; say so, so it isn't added a second time.
    return {
      error: `The customer was saved, but its commission wasn't (${commissionError.message}). Don't save this form again: open the customer and edit its commission there.`,
      values,
    };
  }

  redirect(`/clients/${savedId}`);
}

// Hides a customer from lists (nothing is deleted), or brings it back.
// A customer can't be archived while machines are still placed at its sites.
export async function setArchived(clientId: string, archive: boolean): Promise<FormState> {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(clientId)) return { error: "This customer wasn't found." };
  const supabase = await createClient();

  if (archive) {
    const { data: sites } = await supabase.from("locations").select("id").eq("client_id", clientId);
    const siteIds = (sites ?? []).map((s) => s.id as string);
    if (siteIds.length) {
      const { count } = await supabase
        .from("machine_placements")
        .select("id", { count: "exact", head: true })
        .in("location_id", siteIds)
        .is("ended_on", null);
      if (count) {
        return {
          error: `${count} machine${count === 1 ? " is" : "s are"} still placed at this customer's sites. Move or take ${count === 1 ? "it" : "them"} out first, then archive.`,
        };
      }
    }
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", clientId)
    .select("id");
  if (error) return { error: `Could not save: ${error.message}` };
  if (!data.length) return { error: "This customer wasn't found." };

  revalidatePath(`/clients/${clientId}`);
  return { message: archive ? "Archived. It no longer appears in your Customers list." : "Back in your Customers list." };
}
