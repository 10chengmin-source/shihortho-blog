"use strict";
// SessionStart hook target — see .claude/settings.json. Prints the
// Claude Code hookSpecificOutput.additionalContext JSON contract so any
// article ideas submitted from the mobile capture page (notes/) since the
// last session are injected into context automatically. Must never block
// or slow down session start: always resolves, bails out silently on any
// error or after a short timeout if Supabase is unreachable.

const { callAdminFunction } = require("./notifications-lib");

const TIMEOUT_MS = 5000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function main() {
  const result = await withTimeout(callAdminFunction("list-ideas", {}), TIMEOUT_MS).catch(
    () => null
  );
  if (!result || !result.ok) return;

  const ideas = (result.body && result.body.ideas) || [];
  if (ideas.length === 0) return;

  const lines = ideas.map((idea) => `- [${idea.id}] (${idea.created_at})\n  ${idea.content}`);
  const context =
    `${ideas.length} article idea(s) submitted from the mobile capture page, not yet turned into an article:\n` +
    lines.join("\n\n") +
    `\n\nDiscuss with the user whether/how to turn these into an article. Once used (or explicitly discarded), mark each with scripts/ideas-mark-processed.js <id> so it stops resurfacing.`;

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
