import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

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
    return jsonResponse({ ok: false, error: "invalid_token" }, 400);
  }

  const supabase = supabaseAdmin();

  // unsubscribe_token is stored in recoverable form and stays valid across
  // every future notification email (see the migration that introduced this
  // column), and is never cleared after use, so re-clicking an already-used
  // unsubscribe link still finds the row and succeeds idempotently rather
  // than erroring on the second click.
  const { data: subscriber, error: lookupError } = await supabase
    .from("subscribers")
    .select("id, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (lookupError) {
    console.error("unsubscribe: lookup failed", lookupError);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  if (!subscriber) {
    return jsonResponse({ ok: false, error: "invalid_token" }, 400);
  }

  if (subscriber.status !== "unsubscribed") {
    const { error: updateError } = await supabase
      .from("subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", subscriber.id);

    if (updateError) {
      console.error("unsubscribe: update failed", updateError);
      return jsonResponse({ ok: false, error: "server_error" }, 500);
    }
  }

  return jsonResponse({ ok: true });
});
