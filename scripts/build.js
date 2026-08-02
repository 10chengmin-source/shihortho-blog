const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const IGNORE_DIRS = new Set([
  "assets",
  "scripts",
  "node_modules",
  ".git",
  ".github",
]);

function readMeta(html, name) {
  const re = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']\\s*/?>`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

function gitLastModified(absPath) {
  try {
    const relPath = path.relative(ROOT, absPath).split(path.sep).join("/");
    const out = execSync(`git log -1 --format=%cI -- "${relPath}"`, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (out) return out.slice(0, 10);
  } catch (e) {
    // not in a git repo yet, or file untracked
  }
  return null;
}

function findArticles() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  const articles = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
    const indexPath = path.join(ROOT, entry.name, "index.html");
    if (!fs.existsSync(indexPath)) continue;

    const html = fs.readFileSync(indexPath, "utf8");
    const slug = readMeta(html, "article:slug") || entry.name;
    const title = readMeta(html, "article:title") || slug;
    const excerpt = readMeta(html, "article:excerpt") || "";
    const publishedDate = readMeta(html, "article:date") || "";
    const author = readMeta(html, "article:author") || "";

    const updatedDate =
      gitLastModified(indexPath) ||
      publishedDate ||
      new Date().toISOString().slice(0, 10);

    articles.push({
      dir: entry.name,
      indexPath,
      slug,
      title,
      excerpt,
      publishedDate,
      author,
      updatedDate,
    });
  }

  articles.sort((a, b) => (a.updatedDate < b.updatedDate ? 1 : -1));
  return articles;
}

function updateArticleUpdatedMarker(article) {
  let html = fs.readFileSync(article.indexPath, "utf8");
  const re = /<!-- BUILD:UPDATED:START -->[\s\S]*?<!-- BUILD:UPDATED:END -->/;
  if (!re.test(html)) return;
  const replacement = `<!-- BUILD:UPDATED:START -->${article.updatedDate}<!-- BUILD:UPDATED:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(article.indexPath, next, "utf8");
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCard(article) {
  return `      <article class="card">
        <a href="/${article.dir}/" class="card-link">
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(article.title)}</h3>
            <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
            <div class="card-meta">
              <span class="card-date">${article.updatedDate}</span>
              <span class="card-views" data-slug="${escapeHtml(
                article.slug
              )}">👁 —</span>
            </div>
          </div>
        </a>
      </article>`;
}

function updateHomepageCards(articles) {
  const indexPath = path.join(ROOT, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const re = /<!-- BUILD:CARDS:START -->[\s\S]*?<!-- BUILD:CARDS:END -->/;
  if (!re.test(html)) {
    throw new Error("BUILD:CARDS markers not found in index.html");
  }
  const cardsHtml = articles.map(renderCard).join("\n");
  const replacement = `<!-- BUILD:CARDS:START -->\n${cardsHtml}\n      <!-- BUILD:CARDS:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(indexPath, next, "utf8");
  }
}

function main() {
  const articles = findArticles();
  articles.forEach(updateArticleUpdatedMarker);
  updateHomepageCards(articles);
  console.log(`Built ${articles.length} article(s):`);
  articles.forEach((a) =>
    console.log(`  - ${a.dir} (updated ${a.updatedDate})`)
  );
}

main();
