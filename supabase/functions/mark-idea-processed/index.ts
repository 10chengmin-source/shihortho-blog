import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { isAuthorizedAdmin } from "../_shared/admin-auth.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!isAuthorizedAdmin(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return jsonResponse({ ok: false, error: "id is required" }, 400);
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("article_ideas")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("mark-idea-processed: update failed", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  return jsonResponse({ ok: true });
});
