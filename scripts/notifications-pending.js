"use strict";

const { callAdminFunction } = require("./notifications-lib");

// Always exits 0 — this backs a SessionStart hook, and a Supabase outage or
// misconfigured secret must never block a session from starting. Errors go
// to stderr only; stdout is reserved for the pending-list itself.
async function main() {
  const quietIfEmpty = process.argv.includes("--quiet-if-empty");

  let result;
  try {
    result = await callAdminFunction("list-pending", {});
  } catch (err) {
    console.error(`notifications:pending — request failed: ${err.message}`);
    return;
  }

  if (!result.ok) {
    console.error(`notifications:pending — ${result.status}: ${JSON.stringify(result.body)}`);
    return;
  }

  const items = (result.body && result.body.notifications) || [];
  if (items.length === 0) {
    if (!quietIfEmpty) console.log("No pending article notifications.");
    return;
  }

  console.log(`${items.length} article notification(s) awaiting a decision:\n`);
  for (const item of items) {
    console.log(`- ${item.article_slug} (status: ${item.status}, created: ${item.created_at})`);
  }
}

main();
