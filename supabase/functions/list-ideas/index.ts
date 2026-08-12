import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { isAuthorizedAdmin } from "../_shared/admin-auth.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!isAuthorizedAdmin(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("article_ideas")
    .select("id, content, created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("list-ideas: query failed", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  return jsonResponse({ ok: true, ideas: data });
});
