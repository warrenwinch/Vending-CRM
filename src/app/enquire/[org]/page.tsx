// The enquiry form for your website: anyone can fill it in, no login.
// Each enquiry becomes a Prospect customer. ?embed=1 drops the heading
// for showing the form inside a page of your website.
import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ids";
import { EnquiryForm } from "./enquiry-form";

export const metadata: Metadata = {
  title: "Enquire about a vending machine",
  robots: { index: false, follow: false },
};

export default function EnquirePage({ params, searchParams }: PageProps<"/enquire/[org]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <Enquiry params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Enquiry({ params, searchParams }: Pick<PageProps<"/enquire/[org]">, "params" | "searchParams">) {
  const { org } = await params;
  const embed = (await searchParams).embed === "1";
  const supabase = await createClient();
  const { data: business } = isUuid(org)
    ? await supabase.rpc("public_business_name", { p_org: org })
    : { data: null };

  if (!business) {
    return <p className="mx-auto max-w-sm px-4 py-10 text-center text-zinc-600">Sorry, this form isn&apos;t available.</p>;
  }

  return (
    <>
      {!embed && (
        <div className="border-b-8 border-brand bg-ink px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 text-center text-white">
          <p className="text-sm font-bold tracking-widest text-leaf uppercase">{business as string}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-wide uppercase">Get a vending machine</h1>
        </div>
      )}
      <div className={`mx-auto flex w-full max-w-md flex-col gap-6 px-4 ${embed ? "py-4" : "py-8"}`}>
        {!embed && (
          <p className="text-zinc-600">
            Tell us a little about your workplace and we&apos;ll be in touch to talk about a machine for your site.
          </p>
        )}
        <EnquiryForm org={org} />
      </div>
    </>
  );
}
