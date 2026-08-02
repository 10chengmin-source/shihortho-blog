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

// Update this if a custom domain is connected later (e.g. https://blog.shihortho.net).
const SITE_URL = "https://shihortho-blog.pages.dev";
const SITE_NAME = "背後的力量｜石醫師的骨科札記";
const DOCTOR_NAME = "石承民";
const DEFAULT_OG_IMAGE = "/assets/images/hero-cover.jpg";
const DOCTOR_PORTRAIT = "/assets/images/doctor-portrait.jpg";

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

function extractHeroImage(html) {
  const m = html.match(
    /<img\s+class="(?:hero-img|post-hero-img)"[\s\S]*?src="([^"]+)"/
  );
  return m ? m[1] : DEFAULT_OG_IMAGE;
}

function jsonLdScript(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(
    obj,
    null,
    2
  )}\n  </script>`;
}

function commonOgTags({ title, description, url, image, type }) {
  return [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="zh_TW" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
}

function buildArticleSeo(article, html) {
  const url = `${SITE_URL}/${article.dir}/`;
  const image = SITE_URL + extractHeroImage(html);
  const tags = commonOgTags({
    title: article.title,
    description: article.excerpt,
    url,
    image,
    type: "article",
  });
  tags.push(
    `<meta property="article:published_time" content="${article.publishedDate}" />`,
    `<meta property="article:modified_time" content="${article.updatedDate}" />`
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    headline: article.title,
    description: article.excerpt,
    image,
    author: { "@type": "Person", name: article.author || DOCTOR_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: SITE_URL + DOCTOR_PORTRAIT },
    },
    datePublished: article.publishedDate,
    dateModified: article.updatedDate,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "zh-Hant-TW",
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildHomeSeo() {
  const url = `${SITE_URL}/`;
  const description =
    "石承民醫師的骨科札記，分享脊椎、關節與運動傷害相關的衛教知識、手術理念與臨床觀察。";
  const image = SITE_URL + DEFAULT_OG_IMAGE;
  const tags = commonOgTags({
    title: SITE_NAME,
    description,
    url,
    image,
    type: "website",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url,
    description,
    inLanguage: "zh-Hant-TW",
    publisher: {
      "@type": "Physician",
      name: DOCTOR_NAME,
      medicalSpecialty: "https://schema.org/Orthopedic",
      image: SITE_URL + DOCTOR_PORTRAIT,
      url,
    },
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildAboutSeo() {
  const url = `${SITE_URL}/about/`;
  const description =
    "石承民醫師，臺中榮民總醫院骨科部脊椎外科科主任，專長脊椎手術與骨質疏鬆症治療。";
  const image = SITE_URL + DOCTOR_PORTRAIT;
  const tags = commonOgTags({
    title: `醫師介紹｜${DOCTOR_NAME} 醫師｜背後的力量`,
    description,
    url,
    image,
    type: "profile",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: DOCTOR_NAME,
    image,
    url,
    medicalSpecialty: "https://schema.org/Orthopedic",
    worksFor: {
      "@type": "Hospital",
      name: "臺中榮民總醫院",
    },
    alumniOf: ["陽明交通大學", "高雄醫學大學"],
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function injectSeo(filePath, seoHtml) {
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:SEO:START -->[\s\S]*?<!-- BUILD:SEO:END -->/;
  if (!re.test(html)) return;
  const replacement = `<!-- BUILD:SEO:START -->\n  ${seoHtml}\n  <!-- BUILD:SEO:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function updateAllSeo(articles) {
  injectSeo(path.join(ROOT, "index.html"), buildHomeSeo());
  injectSeo(path.join(ROOT, "about", "index.html"), buildAboutSeo());
  for (const article of articles) {
    const html = fs.readFileSync(article.indexPath, "utf8");
    injectSeo(article.indexPath, buildArticleSeo(article, html));
  }
}

function writeRobotsTxt() {
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, "robots.txt"), content, "utf8");
}

function writeSitemap(articles) {
  const staticUrls = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/about/`, priority: "0.8" },
  ];
  const articleUrls = articles.map((a) => ({
    loc: `${SITE_URL}/${a.dir}/`,
    lastmod: a.updatedDate,
    priority: "0.7",
  }));

  const urlXml = [...staticUrls, ...articleUrls]
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${u.loc}</loc>${lastmod}\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlXml}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
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
  updateAllSeo(articles);
  writeRobotsTxt();
  writeSitemap(articles);
  console.log(`Built ${articles.length} article(s):`);
  articles.forEach((a) =>
    console.log(`  - ${a.dir} (updated ${a.updatedDate})`)
  );
}

main();
