import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { hashToken } from "../_shared/tokens.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "invalid_or_expired" }, 400);
  }

  const tokenHash = await hashToken(token);
  const supabase = supabaseAdmin();

  const { data: subscriber, error: lookupError } = await supabase
    .from("subscribers")
    .select("id, confirm_token_expires_at, status")
    .eq("confirm_token_hash", tokenHash)
    .maybeSingle();

  if (lookupError) {
    console.error("confirm: lookup failed", lookupError);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  if (!subscriber) {
    return jsonResponse({ ok: false, error: "invalid_or_expired" }, 400);
  }

  if (
    subscriber.confirm_token_expires_at &&
    new Date(subscriber.confirm_token_expires_at).getTime() < Date.now()
  ) {
    return jsonResponse({ ok: false, error: "invalid_or_expired" }, 400);
  }

  const { error: updateError } = await supabase
    .from("subscribers")
    .update({
      status: "active",
      confirmed_at: new Date().toISOString(),
      confirm_token_hash: null,
      confirm_token_expires_at: null,
    })
    .eq("id", subscriber.id);

  if (updateError) {
    console.error("confirm: update failed", updateError);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  return jsonResponse({ ok: true });
});
