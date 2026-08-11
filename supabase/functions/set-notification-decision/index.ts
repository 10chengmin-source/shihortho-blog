import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { isAuthorizedAdmin } from "../_shared/admin-auth.ts";

const VALID_DECISIONS = ["pending", "do_not_send", "scheduled"] as const;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!isAuthorizedAdmin(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: {
    article_slug?: unknown;
    decision?: unknown;
    available_locales?: unknown;
    scheduled_at?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const slug = typeof body.article_slug === "string" ? body.article_slug : "";
  const decision = body.decision;
  if (!slug) {
    return jsonResponse({ ok: false, error: "article_slug required" }, 400);
  }
  if (!VALID_DECISIONS.includes(decision as (typeof VALID_DECISIONS)[number])) {
    return jsonResponse(
      { ok: false, error: `decision must be one of ${VALID_DECISIONS.join(", ")}` },
      400
    );
  }

  const supabase = supabaseAdmin();
  const row: Record<string, unknown> = {
    article_slug: slug,
    notification_type: "new_article",
    status: decision,
    decided_at: new Date().toISOString(),
  };
  if (body.available_locales && typeof body.available_locales === "object") {
    row.available_locales = body.available_locales;
  }
  if (decision === "scheduled" && typeof body.scheduled_at === "string") {
    row.scheduled_at = body.scheduled_at;
  }

  const { error } = await supabase
    .from("article_notifications")
    .upsert(row, { onConflict: "article_slug,notification_type" });

  if (error) {
    console.error("set-notification-decision: upsert failed", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  return jsonResponse({ ok: true, article_slug: slug, status: decision });
});
