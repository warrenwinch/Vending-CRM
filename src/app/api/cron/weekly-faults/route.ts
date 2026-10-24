// Vercel calls this every Monday morning (see vercel.json) to email the
// weekly fault summary. Nobody is logged in, so it logs in as the "reports"
// team member (a Filler: it can see faults, machines and sites only), which
// keeps every read inside the normal security rules.
//
// Settings in Vercel: CRON_SECRET (Vercel sends it with each call),
// REPORTS_EMAIL and REPORTS_PASSWORD (the reports account's login).
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { sendWeeklySummary } from "@/lib/weekly-summary";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const email = process.env.REPORTS_EMAIL;
  const password = process.env.REPORTS_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "REPORTS_EMAIL or REPORTS_PASSWORD is missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) {
    console.error("Weekly summary: reports login failed", loginError.message);
    return NextResponse.json({ error: "The reports account couldn't log in" }, { status: 500 });
  }

  try {
    const result = await sendWeeklySummary(supabase);
    return NextResponse.json(result);
  } finally {
    await supabase.auth.signOut();
  }
}
