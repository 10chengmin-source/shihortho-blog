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
  "about",
  "dist",
]);

const CATEGORY_ORDER = [
  "philosophy",
  "announcement",
  "surgery",
  "education",
  "story",
];

const CATEGORY_LABELS = {
  philosophy: "我的醫療理念",
  announcement: "石醫師公告",
  surgery: "石醫師的手術室",
  education: "衛教教室",
  story: "臨床的小故事",
  uncategorized: "最新文章",
};

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
    if (out) return out;
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
    const category = readMeta(html, "article:category") || "uncategorized";
    const orderMeta = readMeta(html, "article:order");
    const manualOrder = orderMeta !== null ? Number(orderMeta) : null;

    const gitSortKey = gitLastModified(indexPath);
    const sortKey = gitSortKey || publishedDate || new Date().toISOString();
    const updatedDate = sortKey.slice(0, 10);

    articles.push({
      dir: entry.name,
      indexPath,
      slug,
      title,
      excerpt,
      publishedDate,
      author,
      category,
      updatedDate,
      sortKey,
      manualOrder,
    });
  }

  // Articles with an explicit article:order meta sort by that number
  // (higher = newer = shown first). Articles without it fall back to
  // git last-modified time and are always treated as newer than any
  // manually ordered article, so freshly added posts bubble to the top
  // automatically without needing article:order to be set by hand.
  articles.sort((a, b) => {
    if (a.manualOrder !== null && b.manualOrder !== null) {
      return b.manualOrder - a.manualOrder;
    }
    if (a.manualOrder !== null) return 1;
    if (b.manualOrder !== null) return -1;
    return a.sortKey < b.sortKey ? 1 : -1;
  });
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

function groupByCategory(articles) {
  const groups = new Map();
  for (const article of articles) {
    const key = CATEGORY_LABELS[article.category] ? article.category : "uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  }

  const order = [...CATEGORY_ORDER, "uncategorized"];
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({ key, label: CATEGORY_LABELS[key], articles: groups.get(key) }));
}

function renderSection(group) {
  const cardsHtml = group.articles.map(renderCard).join("\n");
  return `    <section class="category-section">
      <h2 class="section-title">${escapeHtml(group.label)}</h2>
      <div class="card-grid">
${cardsHtml}
      </div>
    </section>`;
}

function updateHomepageCards(articles) {
  const indexPath = path.join(ROOT, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const re = /<!-- BUILD:CARDS:START -->[\s\S]*?<!-- BUILD:CARDS:END -->/;
  if (!re.test(html)) {
    throw new Error("BUILD:CARDS markers not found in index.html");
  }
  const groups = groupByCategory(articles);
  const sectionsHtml = groups.map(renderSection).join("\n\n");
  const replacement = `<!-- BUILD:CARDS:START -->\n${sectionsHtml}\n    <!-- BUILD:CARDS:END -->`;
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
