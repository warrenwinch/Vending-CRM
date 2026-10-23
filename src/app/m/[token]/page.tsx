// The page a customer reaches by scanning a machine's QR sticker. No login.
import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CustomerReportForm } from "./report-form";
import { SUPPORT_PHONE, formatPhone } from "@/lib/qr";

export const metadata: Metadata = {
  title: "Report a problem",
  robots: { index: false, follow: false }, // keep these pages out of search engines
};

export default function QrPage({ params }: PageProps<"/m/[token]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<Header title="Report a problem" />}>
        <QrReport params={params} />
      </Suspense>
    </main>
  );
}

function Header({ title, business }: { title: string; business?: string }) {
  return (
    <div className="border-b-8 border-brand bg-ink px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 text-center text-white">
      {business && <p className="text-sm font-bold tracking-widest text-leaf uppercase">{business}</p>}
      <h1 className="font-display text-3xl font-extrabold tracking-wide uppercase">{title}</h1>
    </div>
  );
}

// site_position arrives once 07_qr_page_position.sql has been run; until then it is simply missing.
type PublicMachine = {
  machine_number: string;
  business_name: string;
  site_name: string | null;
  site_position?: string | null;
};

async function QrReport({ params }: Pick<PageProps<"/m/[token]">, "params">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9a-f]{32}$/.test(token)
    ? await supabase.rpc("public_machine", { p_token: token })
    : { data: null };
  const machine = ((data ?? []) as PublicMachine[])[0];

  if (!machine) {
    return (
      <>
        <Header title="Code not recognised" />
        <p className="mx-auto max-w-sm px-4 py-10 text-center text-zinc-600">
          Sorry, this QR code isn&apos;t linked to a machine. Please let the site&apos;s reception know.
        </p>
      </>
    );
  }

  return (
    <>
      <Header title="Report a problem" business={machine.business_name} />
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-8">
        <div className="rounded-2xl bg-white p-4 text-center ring-2 ring-zinc-200">
          <p>
            Machine <span className="font-mono font-bold">{machine.machine_number}</span>
          </p>
          {machine.site_name && (
            <p className="mt-1 text-lg font-extrabold">
              {[machine.site_name, machine.site_position].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <CustomerReportForm token={token} />
        <div className="flex flex-col gap-2 border-t-2 border-zinc-200 pt-6 text-center">
          <p className="font-bold">Prefer to talk to someone?</p>
          <a href={`tel:${SUPPORT_PHONE}`} className="btn-secondary">
            Call {formatPhone(SUPPORT_PHONE)}
          </a>
        </div>
      </div>
    </>
  );
}
