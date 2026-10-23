// Email alerts, sent through Resend (resend.com). Needs these settings in
// Vercel (never in the code):
//   RESEND_API_KEY  the key from Resend
//   ALERT_EMAIL     who gets alerts; several addresses separated by commas
//   ALERT_FROM      optional sender, e.g. "Watwin CRM <alerts@watwinvending.com.au>"
// If RESEND_API_KEY or ALERT_EMAIL is missing, alerts are simply skipped.
import "server-only";
import { SITE_URL } from "@/lib/qr";

const DEFAULT_FROM = "Watwin CRM <onboarding@resend.dev>"; // Resend's test sender, until your domain is verified

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail({ subject, lines }: { subject: string; lines: [string, string][] }) {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.ALERT_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || to.length === 0) return { skipped: true };

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
    `<table style="margin:16px 20px;font-size:15px;border-collapse:collapse">${rows}</table>` +
    `<p style="margin:0 20px 20px"><a href="${SITE_URL}/faults" style="background:#c2500f;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Open Faults</a></p>` +
    `</div>`;
  const text = `${subject}\n\n${lines.map(([l, v]) => `${l}: ${v}`).join("\n")}\n\nOpen Faults: ${SITE_URL}/faults`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.ALERT_FROM ?? DEFAULT_FROM, to, subject, html, text }),
  });
  if (!res.ok) {
    // Never shown to the customer; visible in Vercel's logs for us.
    console.error("Alert email failed", res.status, await res.text());
    return { skipped: false, ok: false };
  }
  return { skipped: false, ok: true };
}
