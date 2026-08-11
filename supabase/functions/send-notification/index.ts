import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { isAuthorizedAdmin } from "../_shared/admin-auth.ts";
import {
  DEFAULT_LOCALE,
  LOCALES,
  NOTIFICATION_EMAIL_COPY,
  type LocaleCode,
} from "../_shared/locales.ts";
import { sendEmail } from "../_shared/resend.ts";
import { renderNotificationEmail } from "../_shared/email-template.ts";

const CLAIMABLE_STATUSES = ["pending", "scheduled", "failed"];

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
    article_title?: unknown;
    article_excerpt?: unknown;
    available_locales?: unknown;
    confirm?: unknown;
    acknowledge_resend_of?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const slug = typeof body.article_slug === "string" ? body.article_slug : "";
  const title = typeof body.article_title === "string" ? body.article_title : "";
  const excerpt = typeof body.article_excerpt === "string" ? body.article_excerpt : "";
  const availableLocales =
    body.available_locales && typeof body.available_locales === "object"
      ? (body.available_locales as Record<string, string>)
      : {};

  if (!slug || !title || Object.keys(availableLocales).length === 0) {
    return jsonResponse(
      { ok: false, error: "article_slug, article_title, and available_locales are required" },
      400
    );
  }
  if (body.confirm !== true) {
    return jsonResponse(
      { ok: false, error: "confirm must be true — call preview-notification first" },
      400
    );
  }

  const supabase = supabaseAdmin();

  const { data: current, error: fetchError } = await supabase
    .from("article_notifications")
    .select("status, sent_at")
    .eq("article_slug", slug)
    .eq("notification_type", "new_article")
    .maybeSingle();

  if (fetchError) {
    console.error("send-notification: fetch failed", fetchError);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }
  if (!current) {
    return jsonResponse({ ok: false, error: "no notification record for this article" }, 404);
  }

  // Claim the job atomically. Two code paths because a resend needs an
  // explicit acknowledgment of the prior send (checked against the real
  // stored sent_at) — a normal claim never touches an already-'sent' row.
  let claimError;
  if (current.status === "sent") {
    if (
      typeof body.acknowledge_resend_of !== "string" ||
      body.acknowledge_resend_of !== current.sent_at
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "already_sent",
          sent_at: current.sent_at,
          message: `This article was already sent on ${current.sent_at}. Pass acknowledge_resend_of set to exactly that timestamp to resend.`,
        },
        409
      );
    }
    const { error, count } = await supabase
      .from("article_notifications")
      .update({ status: "sending", sending_started_at: new Date().toISOString() })
      .eq("article_slug", slug)
      .eq("notification_type", "new_article")
      .eq("status", "sent")
      .eq("sent_at", current.sent_at)
      .select("*", { count: "exact", head: true });
    claimError = error;
    if (!error && count === 0) {
      return jsonResponse({ ok: false, error: "already_claimed_by_another_request" }, 409);
    }
  } else {
    if (!CLAIMABLE_STATUSES.includes(current.status)) {
      return jsonResponse(
        { ok: false, error: `cannot send from status "${current.status}"` },
        409
      );
    }
    const { error, count } = await supabase
      .from("article_notifications")
      .update({ status: "sending", sending_started_at: new Date().toISOString() })
      .eq("article_slug", slug)
      .eq("notification_type", "new_article")
      .in("status", CLAIMABLE_STATUSES)
      .select("*", { count: "exact", head: true });
    claimError = error;
    if (!error && count === 0) {
      // Zero rows matched: another call already claimed this job first. This
      // race-safety is the actual idempotency guard — a retry/duplicate call
      // simply finds nothing left to claim.
      return jsonResponse({ ok: false, error: "already_claimed_by_another_request" }, 409);
    }
  }

  if (claimError) {
    console.error("send-notification: claim failed", claimError);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  const { data: subscribers, error: subsError } = await supabase
    .from("subscribers")
    .select("id, email, locale, unsubscribe_token")
    .eq("status", "active");

  if (subsError) {
    console.error("send-notification: subscriber query failed", subsError);
    await supabase
      .from("article_notifications")
      .update({ status: "failed", failed_reason: "subscriber query failed" })
      .eq("article_slug", slug)
      .eq("notification_type", "new_article");
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }

  let sentCount = 0;
  let lastMessageId: string | null = null;
  const failures: string[] = [];

  for (const subscriber of subscribers) {
    const subLocale = subscriber.locale as LocaleCode;
    const effectiveLocale: LocaleCode = availableLocales[subLocale] ? subLocale : DEFAULT_LOCALE;
    const articleUrl = availableLocales[effectiveLocale];
    if (!articleUrl) continue; // shouldn't happen: DEFAULT_LOCALE is always required to be present

    const copy = NOTIFICATION_EMAIL_COPY[effectiveLocale];
    const siteOrigin = articleUrl.split("/").slice(0, 3).join("/");
    const localePrefix = effectiveLocale === DEFAULT_LOCALE ? "" : `${effectiveLocale}/`;
    const unsubscribeUrl = `${siteOrigin}/${localePrefix}subscribe/unsubscribed/?token=${subscriber.unsubscribe_token}`;

    const html = renderNotificationEmail({
      siteName: LOCALES[effectiveLocale].siteName,
      eyebrow: copy.eyebrow,
      title,
      excerpt: excerpt || undefined,
      ctaLabel: copy.cta,
      ctaUrl: articleUrl,
      unsubscribeLabel: copy.unsubscribe,
      unsubscribeUrl,
    });

    const result = await sendEmail({
      to: subscriber.email,
      subject: title,
      html,
    });

    if (result.ok) {
      sentCount++;
      if (result.id) lastMessageId = result.id;
    } else {
      failures.push(`${subscriber.email}: ${result.error}`);
      console.error("send-notification: send failed", subscriber.email, result.error);
    }
  }

  if (sentCount === 0 && subscribers.length > 0) {
    await supabase
      .from("article_notifications")
      .update({
        status: "failed",
        failed_reason: failures.slice(0, 5).join("; ") || "no recipients sent",
      })
      .eq("article_slug", slug)
      .eq("notification_type", "new_article");
    return jsonResponse({ ok: false, error: "all sends failed", details: failures }, 502);
  }

  await supabase
    .from("article_notifications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      message_id: lastMessageId,
      recipient_count: sentCount,
      failed_reason: failures.length > 0 ? failures.slice(0, 5).join("; ") : null,
    })
    .eq("article_slug", slug)
    .eq("notification_type", "new_article");

  return jsonResponse({
    ok: true,
    sent: sentCount,
    total_active_subscribers: subscribers.length,
    failures: failures.length,
  });
});
