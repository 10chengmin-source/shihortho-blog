"use strict";

const { callAdminFunction, findAvailableLocales } = require("./notifications-lib");

// Maps the 3-way publish decision to the schema's actual status values.
// "now" and "later" are both stored as "pending" — the DB doesn't need to
// distinguish them because the only difference is what Claude does *next*:
// for "now" it immediately follows up with notifications-send.js, for
// "later" it stops here and the article waits, resurfacing at most once per
// future session (see CLAUDE.md) until "now" or "never" is chosen.
const DECISION_MAP = {
  now: "pending",
  later: "pending",
  never: "do_not_send",
};

async function main() {
  const [slug, choice] = process.argv.slice(2);

  if (!slug || !DECISION_MAP[choice]) {
    console.error("Usage: node scripts/notifications-decide.js <slug> <now|later|never>");
    process.exit(1);
  }

  const availableLocales = findAvailableLocales(slug);
  if (Object.keys(availableLocales).length === 0) {
    console.error(`No published copy of "${slug}" found in any locale — check the slug.`);
    process.exit(1);
  }

  const result = await callAdminFunction("set-notification-decision", {
    article_slug: slug,
    decision: DECISION_MAP[choice],
    available_locales: availableLocales,
  });

  if (!result.ok) {
    console.error(`Failed to record decision: ${result.status} ${JSON.stringify(result.body)}`);
    process.exit(1);
  }

  console.log(`Recorded: ${slug} -> ${result.body.status}`);
}

main();
