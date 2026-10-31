import Link from "next/link";

// Choose between stickers for A4 sticker paper and single Dymo labels.
export function LabelSizeSwitch({ path, dymo }: { path: string; dymo: boolean }) {
  const chip = (on: boolean) =>
    `rounded-full border-2 px-4 py-1.5 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white text-ink"}`;
  return (
    <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Sticker size">
      <Link href={path} className={chip(!dymo)} aria-current={!dymo ? "page" : undefined}>
        A4 sheet
      </Link>
      <Link href={`${path}?size=dymo`} className={chip(dymo)} aria-current={dymo ? "page" : undefined}>
        Dymo label (59 × 102 mm)
      </Link>
    </div>
  );
}
