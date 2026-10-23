// Supabase connection for code that runs in the browser (forms, buttons).
import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
