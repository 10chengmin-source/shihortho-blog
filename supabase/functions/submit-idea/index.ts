import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const MAX_LENGTH = 8000;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return jsonResponse({ ok: false, error: "content is required" }, 400);
  }
  if (content.length > MAX_LENGTH) {
    return jsonResponse({ ok: false, error: "content too long" }, 400);
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("article_ideas").insert({ content });

  if (error) {
    console.error("submit-idea: insert failed", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  return jsonResponse({ ok: true });
});
