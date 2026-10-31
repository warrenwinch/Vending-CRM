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
        {place && <p className="text-left text-[10.5pt] leading-tight font-extrabold">{place}</p>}
      </div>
    </div>
  );
}

// The same sticker for a Dymo LabelWriter roll: 59 × 102 mm labels, one per
// page, black only (the printer can't do colour).
export async function DymoLabel({
  machineNumber,
  place,
  publicToken,
}: {
  machineNumber: string;
  place: string | null;
  publicToken: string;
}) {
  const svg = await qrSvg(reportUrl(publicToken), "#000000");
  return (
    <div className="flex h-[102mm] w-[59mm] flex-col items-center justify-between overflow-hidden bg-white px-[3mm] py-[3.5mm] text-center text-black outline-1 outline-zinc-300 outline-dashed break-after-page last:break-after-auto print:outline-none">
      <p className="w-full rounded-[1.5mm] bg-black py-[1.2mm] font-display text-[12.5pt] leading-tight font-extrabold tracking-wide text-white uppercase">
        Machine not working?
      </p>
      {/* The QR library makes a plain SVG picture of the code; black on white scans best. */}
      <div
        className="w-[44mm] [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="flex flex-col gap-[1mm]">
        <p className="font-display text-[13pt] leading-tight font-extrabold uppercase">Scan to tell us</p>
        <p className="text-[10.5pt] leading-tight font-bold">
          or call <span className="whitespace-nowrap">{formatPhone(SUPPORT_PHONE)}</span>
        </p>
      </div>
      <div className="w-full border-t-[0.6mm] border-black pt-[1.5mm] text-[9pt] leading-snug">
        <p className="flex items-center justify-between gap-[2mm] font-bold">
          <span className="font-mono text-[10.5pt]">{machineNumber}</span>
          <span>Watwin Vending</span>
        </p>
        {place && <p className="line-clamp-2 text-left text-[10pt] leading-tight font-extrabold">{place}</p>}
      </div>
    </div>
  );
}

// Sets the printed page to one Dymo label with no margins, for pages showing DymoLabels.
export function DymoPageSize() {
  return (
    <style>{`@media print {
  @page { size: 59mm 102mm; margin: 0; }
  main { padding: 0 !important; gap: 0 !important; max-width: none !important; }
}`}</style>
  );
}

// Plain-English steps for the print window, shown on screen only.
export function DymoPrintSteps() {
  return (
    <details className="rounded-2xl border-2 border-zinc-200 bg-white p-4 text-sm text-zinc-600 print:hidden">
      <summary className="cursor-pointer font-bold text-ink">How to print on the Dymo</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Load the 59 × 102 mm labels (1933086) in the LabelWriter 550.</li>
        <li>Click Print. In the print window, set Destination to the DYMO LabelWriter 550.</li>
        <li>
          Open More settings: Paper size = the 59 × 102 mm label (1933086), Margins = None, Scale = Default (100), and
          untick Headers and footers.
        </li>
        <li>The preview should show one sticker per label. Print one first to check it lines up.</li>
      </ol>
    </details>
  );
}
