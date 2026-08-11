import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { isAuthorizedAdmin } from "../_shared/admin-auth.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, type LocaleCode } from "../_shared/locales.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (!isAuthorizedAdmin(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: { available_locales?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const availableLocales =
    body.available_locales && typeof body.available_locales === "object"
      ? (body.available_locales as Record<string, string>)
      : {};

  const supabase = supabaseAdmin();
  const { data: subscribers, error } = await supabase
    .from("subscribers")
    .select("locale")
    .eq("status", "active");

  if (error) {
    console.error("preview-notification: query failed", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  // Group by the locale each subscriber will actually receive, applying the
  // site's fallback rule: subscriber's own locale if this article has a
  // version in it, else the default locale (zh) — matches send-notification's
  // own recipient-resolution logic exactly, so this preview is accurate.
  const byLocale: Record<string, number> = Object.fromEntries(LOCALE_CODES.map((c) => [c, 0]));
  for (const sub of subscribers) {
    const subLocale = sub.locale as LocaleCode;
    const effective = availableLocales[subLocale] ? subLocale : DEFAULT_LOCALE;
    byLocale[effective] = (byLocale[effective] || 0) + 1;
  }

  return jsonResponse({ ok: true, total: subscribers.length, byLocale });
});
