// A printable sticker for one machine: its QR code, number, where it is,
// and a phone number for people who'd rather call.
import { SUPPORT_PHONE, formatPhone, qrSvg, reportUrl } from "@/lib/qr";

export async function MachineLabel({
  machineNumber,
  place,
  publicToken,
}: {
  machineNumber: string;
  place: string | null; // e.g. "ABS House, Level 4N"
  publicToken: string;
}) {
  const svg = await qrSvg(reportUrl(publicToken));
  return (
    <div className="flex w-[64mm] flex-col items-center gap-[1.8mm] overflow-hidden rounded-[3mm] border-[0.6mm] border-ink bg-white p-[3mm] text-center text-ink break-inside-avoid">
      <p className="w-full rounded-[1.5mm] bg-ink py-[1mm] font-display text-[13pt] leading-tight font-extrabold tracking-wide text-white uppercase">
        Machine not working?
      </p>
      {/* The QR library makes a plain SVG picture of the code. */}
      <div className="w-[42mm] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="font-display text-[12pt] leading-tight font-extrabold uppercase">Scan to tell us</p>
      <p className="text-[10pt] leading-tight font-bold">
        or call <span className="whitespace-nowrap text-brand-deep">{formatPhone(SUPPORT_PHONE)}</span>
      </p>
      <div className="w-full border-t-[0.6mm] border-brand pt-[1.5mm] text-[9pt] leading-snug">
        <p className="flex items-center justify-between gap-[2mm] font-bold">
          <span className="font-mono text-[10pt]">{machineNumber}</span>
          <span>Watwin Vending</span>
        </p>
        {place && <p className="truncate text-left font-medium">{place}</p>}
      </div>
    </div>
  );
}
