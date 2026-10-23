import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Vending CRM</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Setup page. Sign-in and the rest of the app come next.
      </p>
      <Suspense
        fallback={<StatusCard tone="neutral" title="Checking the database…" />}
      >
        <DatabaseStatus />
      </Suspense>
    </main>
  );
}

// Asks Supabase how many organizations exist. Without logging in the
// security rules allow none, so a working connection answers with no
// rows and no error. A wrong key or a missing table gives an error.
async function DatabaseStatus() {
  await connection();

  if (!supabaseConfigured) {
    return (
      <StatusCard
        tone="bad"
        title="Supabase is not set up yet"
        detail="NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing."
      />
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true });

  if (error) {
    return (
      <StatusCard
        tone="bad"
        title="Could not reach the database"
        detail={error.message || "Check the URL and key."}
      />
    );
  }

  return (
    <StatusCard
      tone="good"
      title="Connected to Supabase"
      detail="The database answered and its security rules are on."
    />
  );
}

function StatusCard({
  tone,
  title,
  detail,
}: {
  tone: "good" | "bad" | "neutral";
  title: string;
  detail?: string;
}) {
  const colours = {
    good: "border-green-600 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
    bad: "border-red-600 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
    neutral: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  };
  return (
    <div className={`rounded-lg border-l-4 p-4 ${colours[tone]}`}>
      <p className="font-medium">{title}</p>
      {detail && <p className="mt-1 text-sm">{detail}</p>}
    </div>
  );
}
