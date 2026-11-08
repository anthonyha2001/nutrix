import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";
import type { Database } from "./database.types";

// Service-role client: bypasses RLS. Server-only, and only for the few flows
// that must act before anyone is signed in (e.g. invite links), and to save
// products looked up on Open Food Facts into the shared food library.
export function createAdminClient() {
  // Supabase now calls it the "secret" key; older projects say "service role".
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set");
  return createClient<Database>(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
