const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const EXCLUDE_DIRS = new Set([
  "dist",
  "scripts",
  "node_modules",
  ".git",
  ".github",
]);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    if (!entry.isDirectory() && !entry.name.endsWith(".html")) continue;

    copyRecursive(path.join(ROOT, entry.name), path.join(DIST, entry.name));
  }

  console.log("dist/ prepared for deployment.");
}

main();
