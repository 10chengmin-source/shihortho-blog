"use strict";

const { callAdminFunction } = require("./notifications-lib");

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: node scripts/ideas-mark-processed.js <idea-id>");
    process.exitCode = 1;
    return;
  }

  const result = await callAdminFunction("mark-idea-processed", { id });
  if (!result.ok) {
    console.error(`Failed to mark idea processed: ${result.status} ${JSON.stringify(result.body)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Marked idea ${id} as processed.`);
}

main();
