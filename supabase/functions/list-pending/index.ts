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
    .from("article_notifications")
    .select(
      "article_slug, status, available_locales, decided_at, last_prompted_at, scheduled_at, sent_at, failed_reason, created_at"
    )
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("list-pending: query failed", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  // Record that these were surfaced, for audit/informational purposes only —
  // the actual "don't re-prompt within the same Claude Code session" rule is
  // enforced by Claude's own behavior (see CLAUDE.md), not by this timestamp.
  if (data.length > 0) {
    await supabase
      .from("article_notifications")
      .update({ last_prompted_at: new Date().toISOString() })
      .in(
        "article_slug",
        data.map((row) => row.article_slug)
      );
  }

  return jsonResponse({ ok: true, notifications: data });
});
