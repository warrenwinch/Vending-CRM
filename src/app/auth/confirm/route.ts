// The links in confirmation and password-reset emails land here. It turns
// the one-time code into a login, then sends the person on: to set up
// their business (or join one), or to choose a new password.
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  // Only these two destinations are allowed, so the link can't be bent to send people elsewhere.
  const next = searchParams.get("next") === "/reset-password" || type === "recovery" ? "/reset-password" : "/setup";
  return NextResponse.redirect(new URL(ok ? next : "/login?error=confirm", origin));
}
