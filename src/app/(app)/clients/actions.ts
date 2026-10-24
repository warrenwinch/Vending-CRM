"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isClientStatus } from "@/lib/client-types";
import { isCommissionType, parseCommissionRate } from "@/lib/location-types";
import { digitsOnly, isValidAbn } from "@/lib/au";
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
  if (!data?.length) return fail("Could not save this client. It may have been removed.");

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
      error: `The client was saved, but its commission wasn't (${commissionError.message}). Don't save this form again: open the client and edit its commission there.`,
      values,
    };
  }

  redirect(`/clients/${savedId}`);
}
