import { createClient } from "jsr:@supabase/supabase-js@2";

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically injected into
// every Edge Function's runtime environment by Supabase — never set by hand,
// never exposed to the browser. This client bypasses RLS (service_role),
// which is exactly why every table read/write for this feature is routed
// through a function using this client rather than direct PostgREST calls.
export function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
