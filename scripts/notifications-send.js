"use strict";

const { callAdminFunction, findAvailableLocales, readArticleMeta } = require("./notifications-lib");

function parseArgs(argv) {
  const slug = argv[0];
  let confirm = false;
  let acknowledgeResendOf = null;
  for (const arg of argv.slice(1)) {
    if (arg === "--confirm") confirm = true;
    else if (arg.startsWith("--acknowledge-resend-of=")) {
      acknowledgeResendOf = arg.slice("--acknowledge-resend-of=".length);
    }
  }
  return { slug, confirm, acknowledgeResendOf };
}

async function main() {
  const { slug, confirm, acknowledgeResendOf } = parseArgs(process.argv.slice(2));
  if (!slug) {
    console.error(
      "Usage: node scripts/notifications-send.js <slug> [--confirm] [--acknowledge-resend-of=<timestamp>]"
    );
    process.exit(1);
  }

  const availableLocales = findAvailableLocales(slug);
  if (Object.keys(availableLocales).length === 0) {
    console.error(`No published copy of "${slug}" found in any locale — check the slug.`);
    process.exit(1);
  }

  if (!confirm) {
    const preview = await callAdminFunction("preview-notification", {
      available_locales: availableLocales,
    });
    if (!preview.ok) {
      console.error(`Preview failed: ${preview.status} ${JSON.stringify(preview.body)}`);
      process.exit(1);
    }
    console.log(`Preview for "${slug}" (not sent yet — pass --confirm to send):`);
    console.log(`  total active subscribers: ${preview.body.total}`);
    for (const [locale, count] of Object.entries(preview.body.byLocale)) {
      console.log(`    ${locale}: ${count}`);
    }
    return;
  }

  const meta = readArticleMeta(slug, "zh");
  const payload = {
    article_slug: slug,
    article_title: meta ? meta.title : slug,
    article_excerpt: meta ? meta.excerpt : "",
    available_locales: availableLocales,
    confirm: true,
  };
  if (acknowledgeResendOf) payload.acknowledge_resend_of = acknowledgeResendOf;

  const result = await callAdminFunction("send-notification", payload);

  if (result.status === 409 && result.body && result.body.error === "already_sent") {
    console.error(
      `This article was already sent on ${result.body.sent_at}. Re-run with --acknowledge-resend-of=${result.body.sent_at} to resend.`
    );
    process.exit(1);
  }

  if (!result.ok) {
    console.error(`Send failed: ${result.status} ${JSON.stringify(result.body)}`);
    process.exit(1);
  }

  console.log(
    `Sent to ${result.body.sent}/${result.body.total_active_subscribers} active subscribers` +
      (result.body.failures ? ` (${result.body.failures} failure(s) — check server logs)` : "")
  );
}

main();
