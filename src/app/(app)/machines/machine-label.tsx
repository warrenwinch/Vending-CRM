// A printable sticker for one machine: its QR code, number and a short instruction.
import { qrSvg, reportUrl } from "@/lib/qr";

export async function MachineLabel({ machineNumber, publicToken }: { machineNumber: string; publicToken: string }) {
  const svg = await qrSvg(reportUrl(publicToken));
  return (
    <div className="flex w-[64mm] flex-col items-center gap-[2mm] overflow-hidden rounded-[3mm] border-[0.6mm] border-ink bg-white p-[3mm] text-center text-ink break-inside-avoid">
      <p className="w-full rounded-[1.5mm] bg-ink py-[1mm] font-display text-[13pt] leading-tight font-extrabold tracking-wide text-white uppercase">
        Machine not working?
      </p>
      {/* The QR library makes a plain SVG picture of the code. */}
      <div className="w-[44mm] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="font-display text-[12pt] leading-tight font-extrabold uppercase">Scan to tell us</p>
      <p className="flex w-full items-center justify-between border-t-[0.6mm] border-brand pt-[1.5mm] text-[9pt] font-bold">
        <span>Watwin Vending</span>
        <span className="font-mono">{machineNumber}</span>
      </p>
    </div>
  );
}
