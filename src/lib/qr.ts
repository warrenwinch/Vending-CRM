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
