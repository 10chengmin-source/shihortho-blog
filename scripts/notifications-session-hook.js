"use strict";
// SessionStart hook target — see .claude/settings.json. Prints the
// Claude Code hookSpecificOutput.additionalContext JSON contract so a
// pending-notification list is injected into context automatically at the
// start of a session. Must never block or slow down session start: always
// resolves (never throws past main), and bails out silently on any error
// or after a short timeout if Supabase is unreachable.

const { callAdminFunction } = require("./notifications-lib");

const TIMEOUT_MS = 5000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function main() {
  const result = await withTimeout(callAdminFunction("list-pending", {}), TIMEOUT_MS).catch(
    () => null
  );
  if (!result || !result.ok) return;

  const items = (result.body && result.body.notifications) || [];
  if (items.length === 0) return;

  const lines = items.map(
    (item) => `- ${item.article_slug} (status: ${item.status}, created: ${item.created_at})`
  );
  const context =
    `${items.length} article notification decision(s) are still pending from a previous session:\n` +
    lines.join("\n") +
    `\n\nPer CLAUDE.md: ask about each one at most once this session (unless the user explicitly asks to handle pending notifications), and record the answer with scripts/notifications-decide.js.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    })
  );
}

main().catch(() => {});
