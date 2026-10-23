// The frame around every signed-in page: business name, menu and log out.
import { Suspense } from "react";
import { requireProfile, OFFICE_ROLES } from "@/lib/auth";
import { logOut } from "@/app/auth/actions";
import { NavLinks, type NavItem } from "./nav-links";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Suspense fallback={<p className="text-sm font-semibold">Vending CRM</p>}>
            <Menu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </>
  );
}

async function Menu() {
  const { profile } = await requireProfile();

  // Only show links to screens this role can use.
  const items: NavItem[] = [{ href: "/", label: "Home" }];
  if (OFFICE_ROLES.includes(profile.role)) items.push({ href: "/clients", label: "Clients" });
  items.push({ href: "/locations", label: "Locations" }, { href: "/machines", label: "Machines" });

  return (
    <>
      <p className="mr-auto truncate text-sm font-semibold">{profile.organizationName}</p>
      <NavLinks items={items} />
      <form action={logOut}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
        >
          Log out
        </button>
      </form>
    </>
  );
}
