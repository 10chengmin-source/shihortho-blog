"use strict";

const { callAdminFunction } = require("./notifications-lib");

// Always exits 0 — mirrors notifications-pending.js. Errors go to stderr
// only so a Supabase outage never blocks anything that depends on this.
async function main() {
  const quietIfEmpty = process.argv.includes("--quiet-if-empty");

  let result;
  try {
    result = await callAdminFunction("list-ideas", {});
  } catch (err) {
    console.error(`ideas:pending — request failed: ${err.message}`);
    return;
  }

  if (!result.ok) {
    console.error(`ideas:pending — ${result.status}: ${JSON.stringify(result.body)}`);
    return;
  }

  const ideas = (result.body && result.body.ideas) || [];
  if (ideas.length === 0) {
    if (!quietIfEmpty) console.log("No unprocessed article ideas.");
    return;
  }

  console.log(`${ideas.length} unprocessed article idea(s):\n`);
  for (const idea of ideas) {
    console.log(`- [${idea.id}] (${idea.created_at})\n  ${idea.content}\n`);
  }
}

main();
