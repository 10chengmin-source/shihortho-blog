import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { generateToken, hashToken } from "../_shared/tokens.ts";
import { isValidLocale, LOCALES, localePath, CONFIRM_EMAIL_COPY } from "../_shared/locales.ts";
import { sendEmail } from "../_shared/resend.ts";
import { renderConfirmEmail } from "../_shared/email-template.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESUBMIT_COOLDOWN_MS = 60_000;

// Always the same shape regardless of what actually happened server-side —
// this is the load-bearing anti-enumeration measure: a caller can never tell
// from the response whether an email was new, already pending, or already
// active.
const GENERIC_RESPONSE = {
  ok: true,
  message: "If that email is valid, a confirmation link is on its way.",
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: { email?: unknown; locale?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  // Honeypot: a real visitor never fills this hidden field. A bot that fills
  // every field will. Return the generic success without doing anything.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return jsonResponse(GENERIC_RESPONSE);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const locale = body.locale;

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return jsonResponse({ ok: false, error: "Invalid email" }, 400);
  }
  if (!isValidLocale(locale)) {
    return jsonResponse({ ok: false, error: "Invalid locale" }, 400);
  }

  const supabase = supabaseAdmin();
  // Escape ilike wildcards (% _) so an email containing them can't broaden
  // the match beyond an exact case-insensitive comparison.
  const emailPattern = email.toLowerCase().replace(/[%_]/g, (c) => `\\${c}`);

  const { data: existing, error: lookupError } = await supabase
    .from("subscribers")
    .select("id, status, updated_at, unsubscribe_token")
    .ilike("email", emailPattern)
    .maybeSingle();

  if (lookupError) {
    console.error("subscribe: lookup failed", lookupError);
    return jsonResponse(GENERIC_RESPONSE);
  }

  if (existing?.status === "active") {
    return jsonResponse(GENERIC_RESPONSE);
  }

  if (existing && Date.now() - new Date(existing.updated_at).getTime() < RESUBMIT_COOLDOWN_MS) {
    return jsonResponse(GENERIC_RESPONSE);
  }

  const confirmToken = generateToken();
  const confirmTokenHash = await hashToken(confirmToken);
  // Unlike the confirm token, this is stored in recoverable (not hashed)
  // form — see the migration that introduced this column for why: it must
  // be re-embeddable, unchanged, in every future notification email.
  const unsubscribeToken = existing?.unsubscribe_token ?? generateToken();
  const confirmExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const row = {
    email,
    locale,
    status: "pending_confirmation" as const,
    confirm_token_hash: confirmTokenHash,
    confirm_token_expires_at: confirmExpiresAt,
    unsubscribe_token: unsubscribeToken,
  };

  const { error: upsertError } = existing
    ? await supabase.from("subscribers").update(row).eq("id", existing.id)
    : await supabase.from("subscribers").insert({ ...row, subscribed_at: new Date().toISOString() });

  if (upsertError) {
    console.error("subscribe: upsert failed", upsertError);
    return jsonResponse(GENERIC_RESPONSE);
  }

  const copy = CONFIRM_EMAIL_COPY[locale];
  const ctaUrl = `${localePath(locale, "subscribe/confirmed/")}?token=${confirmToken}`;
  const html = renderConfirmEmail({
    siteName: LOCALES[locale].siteName,
    heading: copy.heading,
    body: copy.body,
    ctaLabel: copy.cta,
    ctaUrl,
    ignoreNote: copy.ignoreNote,
  });

  const sendResult = await sendEmail({ to: email, subject: copy.subject, html });
  if (!sendResult.ok) {
    console.error("subscribe: email send failed", sendResult.error);
  }

  return jsonResponse(GENERIC_RESPONSE);
});
