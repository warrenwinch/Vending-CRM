"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole, OFFICE_ROLES } from "@/lib/auth";
import { getOpenPlacement, placeName } from "@/lib/placements";
import { getFault } from "@/lib/faults";
import {
  categoryLabel,
  formatDateTime,
  isFaultCategory,
  isFaultSeverity,
  type FaultCategory,
} from "@/lib/fault-types";
import { sendEmail } from "@/lib/alerts";
import { SITE_URL } from "@/lib/qr";
import { isUuid } from "@/lib/ids";
import { sendWeeklySummary } from "@/lib/weekly-summary";
import type { FormState } from "@/components/form-ui";

const MAX = 2000;
const LEEWAY_MS = 5 * 60 * 1000; // phones' clocks can be a little ahead

// A time from the form (sent as an exact moment), not in the future.
function readTime(text: string, label: string): { at?: string; error?: string } {
  const t = Date.parse(text);
  if (!text || Number.isNaN(t)) return { error: `Please enter ${label}.` };
  if (t > Date.now() + LEEWAY_MS) return { error: `${label[0].toUpperCase()}${label.slice(1)} can't be in the future.` };
  return { at: new Date(t).toISOString() };
}

// Logs a fault on a machine, optionally already fixed.
export async function reportFault(machineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, profile } = await requireProfile();

  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    category: get("category"),
    severity: get("severity"),
    description: get("description"),
    already_fixed: formData.get("already_fixed") === "on" ? "on" : "",
    fix_notes: get("fix_notes"),
  };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(machineId)) return fail("This machine wasn't found.");
  if (!isFaultCategory(values.category)) return fail("Please choose what's wrong.");
  if (!isFaultSeverity(values.severity)) return fail("Please choose how bad it is.");
  if (!values.description) return fail("Please describe the fault.");
  if (values.description.length > MAX || values.fix_notes.length > MAX) return fail(`Please keep it under ${MAX} characters.`);

  const found = readTime(get("found_at"), "when you found it");
  if (found.error) return fail(found.error);

  let fixedAt: string | null = null;
  if (values.already_fixed) {
    const fixed = readTime(get("fixed_at"), "when you fixed it");
    if (fixed.error) return fail(fixed.error);
    if (fixed.at! < found.at!) return fail("The time it was fixed can't be before the time it was found.");
    fixedAt = fixed.at!;
  }

  // Remember which site the machine was at.
  const placement = await getOpenPlacement(machineId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_faults")
    .insert({
      machine_id: machineId,
      location_id: placement?.location_id ?? null,
      category: values.category,
      severity: values.severity,
      description: values.description,
      reported_at: found.at,
      fixed_at: fixedAt,
      fixed_by: fixedAt ? user.id : null,
      fix_notes: fixedAt ? values.fix_notes || null : null,
    })
    .select("id")
    .single();
  if (error) return fail(`Could not save the fault: ${error.message}`);

  // A machine that's not working at all (and not already fixed) emails the
  // ALERT_EMAIL list, after the page has moved on so nobody waits for it.
  if (values.severity === "not_working" && !fixedAt) {
    const faultId = data.id as string;
    after(async () => {
      const { data: m } = await supabase.from("machines").select("machine_number").eq("id", machineId).maybeSingle();
      const number = m?.machine_number ?? "machine";
      const place = placement ? placeName(placement) : "";
      await sendEmail({
        subject: `Not working: ${number}${place ? ` at ${place}` : ""}`,
        lines: [
          ["Machine", number],
          ["Where", place || "Not at a location"],
          ["Problem", categoryLabel(values.category as FaultCategory)],
          ["Details", values.description],
          ["Logged by", profile.fullName || "A team member"],
          ["Found", formatDateTime(found.at!)],
        ],
        button: { label: "Open this fault", href: `${SITE_URL}/faults/${faultId}` },
      });
    });
  }

  redirect(`/faults/${data.id}`);
}

// Marks an open fault as fixed by the person logged in.
export async function markFixed(faultId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireProfile();
  const values = { fix_notes: String(formData.get("fix_notes") ?? "").trim() };
  const fail = (error: string): FormState => ({ error, values });

  if (!isUuid(faultId)) return fail("This fault wasn't found.");
  if (values.fix_notes.length > MAX) return fail(`Please keep it under ${MAX} characters.`);

  const fault = await getFault(faultId);
  if (!fault) return fail("This fault wasn't found.");
  if (fault.fixed_at) redirect(`/faults/${faultId}`);

  const fixed = readTime(String(formData.get("fixed_at") ?? ""), "when you fixed it");
  if (fixed.error) return fail(fixed.error);
  if (fixed.at! < fault.reported_at) return fail("The time it was fixed can't be before the time it was found.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machine_faults")
    .update({ fixed_at: fixed.at, fixed_by: user.id, fix_notes: values.fix_notes || null })
    .eq("id", faultId)
    .is("fixed_at", null)
    .select("id");
  if (error) return fail(`Could not save: ${error.message}`);
  if (!data.length) return fail("Someone else has just marked this fault fixed. Reload the page to see it.");

  redirect(`/faults/${faultId}`);
}

// For faults logged by mistake (office only).
export async function deleteFault(faultId: string, machineId: string) {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(faultId)) return;
  const supabase = await createClient();
  await supabase.from("machine_faults").delete().eq("id", faultId);
  redirect(isUuid(machineId) ? `/machines/${machineId}` : "/faults");
}

// Sends this week's summary straight away, using the Administrator's own login.
export async function sendSummaryNow(): Promise<FormState> {
  await requireRole(["administrator"]);
  const supabase = await createClient();
  const result = await sendWeeklySummary(supabase);
  if (result.skipped) return { error: `Not sent: ${result.reason}.` };
  if (!result.ok) return { error: `Not sent (${result.reason ?? "unknown reason"}).` };
  return { message: "Summary sent. Check the inbox in SUMMARY_EMAIL (or ALERT_EMAIL)." };
}
