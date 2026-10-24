import Link from "next/link";
import { Suspense } from "react";
import { requireProfile, roleLabels, OFFICE_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listFaults } from "@/lib/faults";
import { FaultList } from "./faults/fault-list";

export default function Home() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { profile } = await requireProfile();
  const isOffice = OFFICE_ROLES.includes(profile.role);

  // Counts only (head: true fetches no rows).
  const supabase = await createClient();
  const howMany = { count: "exact", head: true } as const;
  const [openFaultList, machines, locations] = await Promise.all([
    listFaults({ open: true }),
    supabase.from("machines").select("id", howMany).eq("status", "installed"),
    supabase.from("locations").select("id", howMany).eq("status", "active"),
  ]);
  const openFaults = openFaultList.length;
  const installed = machines.count ?? 0;
  const sites = locations.count ?? 0;

  const tiles: { href: string; title: string; detail: string; tone: "brand" | "alert" | "plain" }[] = [
    {
      href: "/faults",
      title: "Faults",
      detail: openFaults ? `${openFaults} open` : "None open",
      tone: openFaults ? "alert" : "plain",
    },
    { href: "/machines", title: "Machines", detail: `${installed} installed`, tone: "brand" },
    { href: "/locations", title: "Locations", detail: `${sites} active sites`, tone: "plain" },
  ];
  if (isOffice) {
    tiles.push(
      { href: "/clients", title: "Customers", detail: "Companies and contacts", tone: "plain" },
      { href: "/commission", title: "Commission", detail: "Payments to customers", tone: "plain" },
    );
  }

  const toneClass = {
    brand: "bg-brand-strong text-white hover:bg-brand-deep",
    alert: "bg-red-700 text-white hover:bg-red-800",
    plain: "bg-white text-ink ring-2 ring-zinc-200 hover:ring-ink",
  };

  return (
    <>
      <div>
        <h1 className="page-title">G&apos;day, {profile.fullName.split(" ")[0]}</h1>
        <p className="mt-1 font-bold text-leaf-deep">{roleLabels[profile.role]}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className={`flex min-h-28 flex-col justify-between rounded-2xl p-5 shadow-sm transition active:translate-y-px ${toneClass[t.tone]}`}
            >
              <span className="font-display text-3xl font-extrabold tracking-wide uppercase">{t.title}</span>
              <span className="text-lg font-bold opacity-90">{t.detail}</span>
            </Link>
          </li>
        ))}
      </ul>

      {openFaults > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="section-title">Open faults</h2>
            <Link href="/faults" className="btn-small">
              See all
            </Link>
          </div>
          <FaultList faults={[...openFaultList].reverse().slice(0, 5)} showMachine empty="" />
          {openFaults > 5 && <p className="text-sm text-zinc-500">Showing the 5 waiting longest.</p>}
        </section>
      )}
    </>
  );
}
