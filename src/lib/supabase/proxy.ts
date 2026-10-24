// Runs before every page request. It keeps the login cookie fresh and
// sends anyone who is not logged in to the log-in page.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

// Pages anyone can open without logging in.
// "/m" is the page customers reach by scanning a machine's QR sticker.
// "/enquire" is the enquiry form linked from (or shown inside) your website.
// "/api/cron" is called by Vercel on a schedule and checks its own secret.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/confirm", "/m", "/enquire", "/api/cron"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Checks the login is genuine (and refreshes it if it is about to expire).
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!loggedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
