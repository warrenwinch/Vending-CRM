// Emails sent through Resend (resend.com): fault alerts and team invitations.
// Needs these settings in Vercel (never in the code):
//   RESEND_API_KEY  the key from Resend
//   ALERT_EMAIL     who gets fault alerts; several addresses separated by commas
//   ALERT_FROM      optional sender, e.g. "Watwin CRM <alerts@watwinvending.com.au>"
// Without RESEND_API_KEY nothing is sent (and the app carries on as normal).
import "server-only";
import { SITE_URL } from "@/lib/qr";

const DEFAULT_FROM = "Watwin CRM <onboarding@resend.dev>"; // Resend's test sender, until your domain is verified

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// reason: why it wasn't sent, in Resend's words (for Administrators, never customers).
export type EmailResult = { skipped: true; reason: string } | { skipped: false; ok: boolean; reason?: string };

// One Watwin-styled email: a charcoal heading, optional intro, a table of
// details and a big orange button.
export async function sendEmail({
  to,
  subject,
  intro,
  lines,
  button = { label: "Open Faults", href: `${SITE_URL}/faults` },
}: {
  to?: string[]; // leave out to send to the ALERT_EMAIL list
  subject: string;
  intro?: string;
  lines: [string, string][];
  button?: { label: string; href: string };
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const recipients = (to ?? (process.env.ALERT_EMAIL ?? "").split(",")).map((s) => s.trim()).filter(Boolean);
  if (!key) return { skipped: true, reason: "the RESEND_API_KEY setting is missing in Vercel" };
  if (recipients.length === 0) return { skipped: true, reason: "there is no address to send to" };

  const rows = lines
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b6b6b;vertical-align:top">${escape(label)}</td>` +
        `<td style="padding:6px 0;font-weight:600;color:#2f2e2c">${escape(value).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:560px">` +
    `<div style="background:#2f2e2c;border-bottom:6px solid #ea631a;color:#fff;padding:16px 20px;font-size:20px;font-weight:800">${escape(subject)}</div>` +
    (intro ? `<p style="margin:16px 20px 0;font-size:15px;color:#2f2e2c">${escape(intro)}</p>` : "") +
    `<table style="margin:16px 20px;font-size:15px;border-collapse:collapse">${rows}</table>` +
    `<p style="margin:0 20px 20px"><a href="${escape(button.href)}" style="background:#c2500f;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">${escape(button.label)}</a></p>` +
    `</div>`;
  const text =
    `${subject}\n\n${intro ? `${intro}\n\n` : ""}${lines.map(([l, v]) => `${l}: ${v}`).join("\n")}` +
    `\n\n${button.label}: ${button.href}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.ALERT_FROM ?? DEFAULT_FROM, to: recipients, subject, html, text }),
  });
  if (!res.ok) {
    // Visible in Vercel's logs; callers decide what (if anything) to tell people.
    const body = await res.text();
    console.error("Email failed", res.status, body);
    let reason = `Resend said ${res.status}`;
    try {
      reason = `Resend said: ${JSON.parse(body).message ?? body}`;
    } catch {
      // not JSON; keep the status
    }
    return { skipped: false, ok: false, reason };
  }
  return { skipped: false, ok: true };
}
