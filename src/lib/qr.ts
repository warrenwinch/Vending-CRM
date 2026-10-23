// QR codes for machine stickers. Each points at that machine's public
// "report a problem" page.
import "server-only";
import QRCode from "qrcode";

// The app's public address, printed into every QR code. Set SITE_URL to change it.
export const SITE_URL = (process.env.SITE_URL ?? "https://crm.watwinvending.com.au").replace(/\/$/, "");

export const reportUrl = (publicToken: string) => `${SITE_URL}/m/${publicToken}`;

// A crisp, printable SVG. "M" error correction still scans if a sticker gets scratched.
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#2f2e2c", light: "#ffffff" } });
}

// The number printed on stickers and offered on the customer page.
// Set SUPPORT_PHONE to change it (digits; spaces are added for display).
export const SUPPORT_PHONE = (process.env.SUPPORT_PHONE ?? "0432028840").replace(/\D/g, "");

// "0432028840" -> "0432 028 840"; landlines "0291234567" -> "02 9123 4567".
export function formatPhone(digits: string) {
  if (/^04\d{8}$/.test(digits)) return digits.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
  if (/^0\d{9}$/.test(digits)) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "$1 $2 $3");
  return digits;
}
