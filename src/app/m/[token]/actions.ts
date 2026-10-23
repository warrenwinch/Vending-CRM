"use server";

import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { CUSTOMER_FAULT_CHOICES, formatDateTime, isFaultCategory, isFaultSeverity } from "@/lib/fault-types";
import { sendEmail } from "@/lib/alerts";
import type { FormState } from "@/components/form-ui";

const TOKEN = /^[0-9a-f]{32}$/;

// A customer's report from a machine's QR code. No login: the database
// function only accepts a report for the machine whose code was scanned.
export async function reportFromQr(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    category: get("category"),
    severity: get("severity"),
    description: get("description"),
    contact: get("contact"),
  };
  const fail = (error: string): FormState => ({ error, values });

  // A hidden box only robots fill in. Pretend it worked so they move on.
  if (get("website")) return { message: "Thanks!" };

  if (!TOKEN.test(token)) return fail("This QR code isn't recognised.");
  if (!isFaultCategory(values.category)) return fail("Please choose what's wrong.");
  if (!isFaultSeverity(values.severity)) return fail("Please say whether the machine is working at all.");
  if (values.description.length < 3) return fail("Please tell us a little about the problem.");
  if (values.description.length > 1000) return fail("Please keep it under 1000 characters.");
  if (values.contact.length > 200) return fail("Please keep your contact details short.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_public_fault", {
    p_token: token,
    p_category: values.category,
    p_severity: values.severity,
    p_description: values.description,
    p_contact: values.contact || null,
  });

  if (error) {
    if (error.message.includes("too_many_reports")) {
      return fail("Thanks, this machine has already been reported recently. Our team is on it.");
    }
    if (error.message.includes("machine_not_found")) return fail("This QR code isn't recognised.");
    return fail("Sorry, something went wrong sending your report. Please try again.");
  }

  // Email the team once the customer has their "thanks" (they never wait for it).
  after(async () => {
    const { data } = await supabase.rpc("public_machine", { p_token: token });
    const m = ((data ?? []) as { machine_number: string; site_name: string | null; site_position?: string | null }[])[0];
    const place = m ? [m.site_name, m.site_position].filter(Boolean).join(", ") : "";
    const label = CUSTOMER_FAULT_CHOICES.find((c) => c.value === values.category)?.label ?? values.category;
    await sendEmail({
      subject: `Customer fault: ${m?.machine_number ?? "machine"}${place ? ` at ${place}` : ""}`,
      lines: [
        ["Machine", m?.machine_number ?? "Unknown"],
        ["Where", place || "Not at a location"],
        ["Problem", label],
        ["Working at all?", values.severity === "not_working" ? "No, not at all" : "Yes, partly"],
        ["Details", values.description],
        ["Customer contact", values.contact || "None given"],
        ["Reported", formatDateTime(new Date().toISOString())],
      ],
    });
  });

  return { message: "Thanks! Your report has been sent to our team." };
}
