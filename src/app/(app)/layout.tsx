// The frame around every signed-in page: business name, menu and log out.
import { Suspense } from "react";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { logOut } from "@/app/auth/actions";
import { NavLinks, type NavItem } from "./nav-links";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* Watwin charcoal bar with an orange stripe, like the launch artwork. */}
      <header className="border-b-[6px] border-brand bg-ink pt-[env(safe-area-inset-top)] text-white print:hidden">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3">
          <Suspense
            fallback={<p className="font-display text-2xl font-extrabold tracking-wide uppercase">Vending CRM</p>}
          >
            <Menu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</main>
    </>
  );
}

async function Menu() {
  const { profile } = await requireProfile();

  // Only show links to screens this role can use.
  const items: NavItem[] = [{ href: "/", label: "Home" }];
  if (OFFICE_ROLES.includes(profile.role)) items.push({ href: "/clients", label: "Customers" });
  items.push(
    { href: "/locations", label: "Locations" },
    { href: "/machines", label: "Machines" },
    { href: "/faults", label: "Faults" },
    { href: "/maintenance", label: "Maintenance" },
  );
  if (OFFICE_ROLES.includes(profile.role)) {
    items.push({ href: "/sales", label: "Sales" }, { href: "/commission", label: "Commission" });
  }
  if (profile.role === "administrator") items.push({ href: "/team", label: "Team" });

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 truncate font-display text-2xl font-extrabold tracking-wide uppercase sm:text-3xl">
          {profile.organizationName}
        </p>
        <form action={logOut}>
          <button
            type="submit"
            className="min-h-10 rounded-lg border-2 border-white/70 px-3 py-1.5 text-sm font-bold text-white hover:bg-white hover:text-ink"
          >
            Log out
          </button>
        </form>
      </div>
      <NavLinks items={items} />
    </>
  );
}
