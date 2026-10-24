"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ids";
import { sendEmail } from "@/lib/alerts";
import { formatDateTime } from "@/lib/fault-types";
import { SITE_URL } from "@/lib/qr";
import type { FormState } from "@/components/form-ui";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// The database function's reasons, in words for the person filling it in.
const PROBLEMS: Record<string, string> = {
  form_not_found: "Sorry, this form isn't available.",
  bad_company: "Please enter your business name.",
  bad_contact: "Please enter your name.",
  no_way_to_reach: "Please give an email or phone number so we can get back to you.",
  bad_email: "Please check your email address.",
  too_long: "Please keep your answers a little shorter.",
  too_many_enquiries: "Sorry, we've had a lot of enquiries just now. Please try again in an hour, or give us a call.",
};

// An enquiry from the website. No login: the database function can only
// add a Prospect customer (and their site) to the business the form is for.
export async function submitEnquiry(org: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const get = (name: string) => String(formData.get(name) ?? "").trim().replace(/\s+/g, " ");
  const values = {
    company: get("company"),
    contact: get("contact"),
    email: get("email"),
    phone: get("phone"),
    address: get("address"),
    people: get("people"),
    message: String(formData.get("message") ?? "").trim(),
  };
  const fail = (error: string): FormState => ({ error, values });

  // A hidden box only robots fill in. Pretend it worked so they move on.
  if (get("website")) return { message: "Thanks! We'll be in touch soon." };

  if (!isUuid(org)) return fail(PROBLEMS.form_not_found);
  if (values.company.length < 2) return fail(PROBLEMS.bad_company);
  if (values.contact.length < 2) return fail(PROBLEMS.bad_contact);
  if (!values.email && !values.phone) return fail(PROBLEMS.no_way_to_reach);
  if (values.email && !EMAIL.test(values.email)) return fail(PROBLEMS.bad_email);

  const supabase = await createClient();
  const { data: clientId, error } = await supabase.rpc("submit_website_lead", {
    p_org: org,
    p_company: values.company,
    p_contact: values.contact,
    p_email: values.email || null,
    p_phone: values.phone || null,
    p_address: values.address || null,
    p_people: values.people || null,
    p_message: values.message || null,
  });
  if (error) {
    const known = Object.keys(PROBLEMS).find((k) => error.message.includes(k));
    return fail(known ? PROBLEMS[known] : "Sorry, something went wrong sending your enquiry. Please try again.");
  }

  // Tell the team once the visitor has their "thanks" (they never wait for it).
  after(async () => {
    await sendEmail({
      subject: `New website enquiry: ${values.company}`,
      intro: "They've been added as a Prospect customer.",
      lines: [
        ["Business", values.company],
        ["Name", values.contact],
        ["Email", values.email || "Not given"],
        ["Phone", values.phone || "Not given"],
        ["Site", values.address || "Not given"],
        ["Staff / visitors", values.people || "Not given"],
        ["Message", values.message || "None"],
        ["Received", formatDateTime(new Date().toISOString())],
      ],
      button: { label: "Open this customer", href: `${SITE_URL}/clients/${clientId as string}` },
    });
  });

  return { message: "Thanks! We've got your enquiry and will be in touch soon." };
}
