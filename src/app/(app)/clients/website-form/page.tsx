// How to put the enquiry form on your website: its link, and the code
// to paste into a WordPress page so the form shows inside it.
import Link from "next/link";
import { Suspense } from "react";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/qr";

export default function WebsiteFormPage() {
  return (
    <>
      <div>
        <Link href="/clients" className="text-sm font-medium text-zinc-500 underline">
          Customers
        </Link>
        <h1 className="page-title">Website enquiry form</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <FormDetails />
      </Suspense>
    </>
  );
}

function Copyable({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-zinc-100 p-3 text-sm whitespace-pre-wrap break-all select-all">{text}</pre>
  );
}

async function FormDetails() {
  await requireRole(OFFICE_ROLES);
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("current_org_id");
  const link = `${SITE_URL}/enquire/${org as string}`;
  const embed = `<iframe src="${link}?embed=1" title="Enquiry form" style="width:100%;max-width:560px;height:1000px;border:0"></iframe>`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p>
        Anyone can fill in this form without logging in. Each enquiry is added as a <strong>Prospect</strong> customer,
        with their site address, staff numbers and message on a Prospect site, and you get an email straight away.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="section-title">The form&apos;s link</h2>
        <p className="text-zinc-600">Use this for a button or link on your website, an email signature or social media.</p>
        <Copyable text={link} />
        <a href={link} target="_blank" rel="noopener" className="btn-secondary self-start">
          Open the form
        </a>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="section-title">Show it inside a WordPress page</h2>
        <ol className="list-decimal space-y-1 pl-5 text-zinc-700">
          <li>In WordPress, edit the page (for example Contact) and click <strong>+</strong> to add a block.</li>
          <li>Choose <strong>Custom HTML</strong>.</li>
          <li>Paste the code below into it (tap the box to select it all), then click <strong>Update</strong>.</li>
        </ol>
        <Copyable text={embed} />
      </section>
    </div>
  );
}
