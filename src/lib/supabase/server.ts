// Supabase connection for code that runs on the server (pages, actions).
// It reads the login cookie so the database knows who is asking.
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Pages can't set cookies; the login refresh step (added with
          // sign-in in step 2) takes care of that.
        }
      },
    },
  });
}
