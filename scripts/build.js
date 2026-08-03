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
  "media",
  "dist",
  "en",
]);
const EN_IGNORE_DIRS = new Set(["about", "media"]);

const CATEGORY_ORDER = [
  "philosophy",
  "announcement",
  "surgery",
  "education",
  "story",
];

const CATEGORY_LABELS = {
  philosophy: "石醫師的醫療理念",
  announcement: "有關石醫師的醫療團隊",
  surgery: "石醫師的手術室",
  education: "漫談骨科",
  story: "臨床的小故事",
  uncategorized: "最新文章",
};

const CATEGORY_LABELS_EN = {
  philosophy: "Dr. Shih's Philosophy of Care",
  announcement: "Practice News",
  surgery: "Surgical Notes",
  education: "Orthopedic Insights",
  story: "Clinical Stories",
  uncategorized: "Latest",
};

const CATEGORY_CODES = {
  philosophy: "PHILOSOPHY",
  announcement: "ANNOUNCEMENT",
  surgery: "SURGERY",
  education: "EDUCATION",
  story: "CASE NOTES",
  uncategorized: "LATEST",
};

// Update this if a custom domain is connected later (e.g. https://blog.shihortho.net).
const SITE_URL = "https://shihortho-blog.pages.dev";
const SITE_NAME = "背後的力量｜石醫師的骨科札記";
const SITE_NAME_EN = "Behind the Strength | Dr. Shih's Orthopedic Notes";
const DOCTOR_NAME = "石承民";
const DOCTOR_NAME_EN = "Dr. Cheng-Min Shih";
const DEFAULT_OG_IMAGE = "/assets/images/hero-cover.jpg";
const DOCTOR_PORTRAIT = "/assets/images/doctor-portrait.jpg";

function readMeta(html, name) {
  // content is always double-quoted in this codebase; only "
  // terminates the match so apostrophes in English copy ("It's",
  // "What's") don't truncate the captured value early.
  const re = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content="([^"]*)"\\s*/?>`,
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

function findArticlesIn(baseDir, ignoreDirs, dirPrefix) {
  if (!fs.existsSync(baseDir)) return [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const articles = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || ignoreDirs.has(entry.name)) continue;
    const indexPath = path.join(baseDir, entry.name, "index.html");
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
      dir: dirPrefix + entry.name,
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

function findArticles() {
  return findArticlesIn(ROOT, IGNORE_DIRS, "");
}

function findEnglishArticles() {
  return findArticlesIn(path.join(ROOT, "en"), EN_IGNORE_DIRS, "en/");
}

function updateArticleCategoryLabel(article, labels) {
  let html = fs.readFileSync(article.indexPath, "utf8");
  const label = labels[article.category] || labels.uncategorized;
  const re = /(<span class="post-category">)[^<]*(<\/span>)/;
  if (!re.test(html)) return;
  const next = html.replace(re, `$1${label}$2`);
  if (next !== html) {
    fs.writeFileSync(article.indexPath, next, "utf8");
  }
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

function commonOgTags({ title, description, url, image, type, locale }) {
  const siteName = locale === "en" ? SITE_NAME_EN : SITE_NAME;
  const ogLocale = locale === "en" ? "en_US" : "zh_TW";
  return [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:locale" content="${ogLocale}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
}

function hreflangTags(zhUrl, enUrl) {
  const tags = [];
  if (zhUrl) tags.push(`<link rel="alternate" hreflang="zh-Hant" href="${zhUrl}" />`);
  if (enUrl) tags.push(`<link rel="alternate" hreflang="en" href="${enUrl}" />`);
  if (zhUrl) tags.push(`<link rel="alternate" hreflang="x-default" href="${zhUrl}" />`);
  return tags;
}

function buildArticleSeo(article, html, locale, counterpart) {
  const url = `${SITE_URL}/${article.dir}/`;
  const image = SITE_URL + extractHeroImage(html);
  const tags = commonOgTags({
    title: article.title,
    description: article.excerpt,
    url,
    image,
    type: "article",
    locale,
  });
  tags.push(
    `<meta property="article:published_time" content="${article.publishedDate}" />`,
    `<meta property="article:modified_time" content="${article.updatedDate}" />`
  );

  const counterpartUrl = counterpart ? `${SITE_URL}/${counterpart.dir}/` : null;
  const zhUrl = locale === "zh" ? url : counterpartUrl;
  const enUrl = locale === "en" ? url : counterpartUrl;
  tags.push(...hreflangTags(zhUrl, enUrl));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    headline: article.title,
    description: article.excerpt,
    image,
    author: {
      "@type": "Person",
      name: article.author || (locale === "en" ? DOCTOR_NAME_EN : DOCTOR_NAME),
    },
    publisher: {
      "@type": "Organization",
      name: locale === "en" ? SITE_NAME_EN : SITE_NAME,
      logo: { "@type": "ImageObject", url: SITE_URL + DOCTOR_PORTRAIT },
    },
    datePublished: article.publishedDate,
    dateModified: article.updatedDate,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: locale === "en" ? "en" : "zh-Hant-TW",
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildHomeSeo(locale) {
  const isEn = locale === "en";
  const url = isEn ? `${SITE_URL}/en/` : `${SITE_URL}/`;
  const siteName = isEn ? SITE_NAME_EN : SITE_NAME;
  const description = isEn
    ? "Dr. Cheng-Min Shih's orthopedic notes: clinical philosophy, surgical insights, and patient education on spine, joint, and sports-related conditions."
    : "石承民醫師的骨科札記，分享脊椎、關節與運動傷害相關的衛教知識、手術理念與臨床觀察。";
  const image = SITE_URL + DEFAULT_OG_IMAGE;
  const tags = commonOgTags({
    title: siteName,
    description,
    url,
    image,
    type: "website",
    locale,
  });
  tags.push(...hreflangTags(`${SITE_URL}/`, `${SITE_URL}/en/`));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url,
    description,
    inLanguage: isEn ? "en" : "zh-Hant-TW",
    publisher: {
      "@type": "Physician",
      name: isEn ? DOCTOR_NAME_EN : DOCTOR_NAME,
      medicalSpecialty: "https://schema.org/Orthopedic",
      image: SITE_URL + DOCTOR_PORTRAIT,
      url,
    },
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildAboutSeo(locale) {
  const isEn = locale === "en";
  const url = isEn ? `${SITE_URL}/en/about/` : `${SITE_URL}/about/`;
  const title = isEn
    ? "About Dr. Shih | Behind the Strength"
    : `醫師介紹｜${DOCTOR_NAME} 醫師｜背後的力量`;
  const description = isEn
    ? "Dr. Cheng-Min Shih, Chief of the Division of Spine Surgery, Department of Orthopedics, Taichung Veterans General Hospital. Specializing in minimally invasive, complex, and revision spine surgery, hip and knee reconstruction, and osteoporosis care."
    : "石承民醫師，臺中榮民總醫院骨科部脊椎外科科主任，專長涵蓋各式微創、複雜及脊椎翻修手術、膝髖關節重建手術與骨質疏鬆治療。";
  const image = SITE_URL + DOCTOR_PORTRAIT;
  const tags = commonOgTags({ title, description, url, image, type: "profile", locale });
  tags.push(...hreflangTags(`${SITE_URL}/about/`, `${SITE_URL}/en/about/`));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: isEn ? DOCTOR_NAME_EN : DOCTOR_NAME,
    image,
    url,
    medicalSpecialty: "https://schema.org/Orthopedic",
    worksFor: {
      "@type": "Hospital",
      name: isEn ? "Taichung Veterans General Hospital" : "臺中榮民總醫院",
    },
    alumniOf: isEn
      ? ["National Yang Ming Chiao Tung University", "Kaohsiung Medical University"]
      : ["陽明交通大學", "高雄醫學大學"],
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function injectSeo(filePath, seoHtml) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:SEO:START -->[\s\S]*?<!-- BUILD:SEO:END -->/;
  if (!re.test(html)) return;
  const replacement = `<!-- BUILD:SEO:START -->\n  ${seoHtml}\n  <!-- BUILD:SEO:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function buildSlugMap(zhArticles, enArticles) {
  const map = new Map();
  for (const a of zhArticles) {
    if (!map.has(a.slug)) map.set(a.slug, {});
    map.get(a.slug).zh = a;
  }
  for (const a of enArticles) {
    if (!map.has(a.slug)) map.set(a.slug, {});
    map.get(a.slug).en = a;
  }
  return map;
}

function updateAllSeo(zhArticles, enArticles) {
  injectSeo(path.join(ROOT, "index.html"), buildHomeSeo("zh"));
  injectSeo(path.join(ROOT, "about", "index.html"), buildAboutSeo("zh"));
  injectSeo(path.join(ROOT, "en", "index.html"), buildHomeSeo("en"));
  injectSeo(path.join(ROOT, "en", "about", "index.html"), buildAboutSeo("en"));

  const slugMap = buildSlugMap(zhArticles, enArticles);
  for (const article of zhArticles) {
    const html = fs.readFileSync(article.indexPath, "utf8");
    const counterpart = slugMap.get(article.slug)?.en || null;
    injectSeo(article.indexPath, buildArticleSeo(article, html, "zh", counterpart));
  }
  for (const article of enArticles) {
    const html = fs.readFileSync(article.indexPath, "utf8");
    const counterpart = slugMap.get(article.slug)?.zh || null;
    injectSeo(article.indexPath, buildArticleSeo(article, html, "en", counterpart));
  }
}

function writeRobotsTxt() {
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, "robots.txt"), content, "utf8");
}

function writeSitemap(zhArticles, enArticles) {
  const staticUrls = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/about/`, priority: "0.8" },
    { loc: `${SITE_URL}/media/`, priority: "0.6" },
  ];
  if (fs.existsSync(path.join(ROOT, "en", "index.html"))) {
    staticUrls.push({ loc: `${SITE_URL}/en/`, priority: "1.0" });
  }
  if (fs.existsSync(path.join(ROOT, "en", "about", "index.html"))) {
    staticUrls.push({ loc: `${SITE_URL}/en/about/`, priority: "0.8" });
  }
  if (fs.existsSync(path.join(ROOT, "en", "media", "index.html"))) {
    staticUrls.push({ loc: `${SITE_URL}/en/media/`, priority: "0.6" });
  }
  const articleUrls = [...zhArticles, ...enArticles].map((a) => ({
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

function renderIndexRow(article, indexInGroup) {
  const num = String(indexInGroup).padStart(2, "0");
  return `        <div class="index-row">
          <span class="index-num">${num}</span>
          <a href="/${article.dir}/" class="index-link">
            <h3 class="index-title">${escapeHtml(article.title)}</h3>
            <p class="index-excerpt">${escapeHtml(article.excerpt)}</p>
            <div class="index-meta">
              <span class="index-date">${article.updatedDate}</span>
              <span class="index-views" data-slug="${escapeHtml(
                article.slug
              )}">👁 —</span>
            </div>
          </a>
        </div>`;
}

function groupByCategory(articles, labels) {
  const groups = new Map();
  for (const article of articles) {
    const key = labels[article.category] ? article.category : "uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  }

  const order = [...CATEGORY_ORDER, "uncategorized"];
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({ key, label: labels[key], articles: groups.get(key) }));
}

function renderSection(group) {
  const rowsHtml = group.articles
    .map((article, i) => renderIndexRow(article, i + 1))
    .join("\n");
  const code = CATEGORY_CODES[group.key] || CATEGORY_CODES.uncategorized;
  return `    <section class="category-section" id="${escapeHtml(group.key)}">
      <span class="section-eyebrow">${escapeHtml(code)}</span>
      <h2 class="section-title">${escapeHtml(group.label)}</h2>
      <div class="index-list">
${rowsHtml}
      </div>
    </section>`;
}

function updateHomepageCards(articles, indexPath, labels) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");
  const re = /<!-- BUILD:CARDS:START -->[\s\S]*?<!-- BUILD:CARDS:END -->/;
  if (!re.test(html)) {
    throw new Error(`BUILD:CARDS markers not found in ${indexPath}`);
  }
  const groups = groupByCategory(articles, labels);
  const sectionsHtml = groups.map(renderSection).join("\n\n");
  const replacement = `<!-- BUILD:CARDS:START -->\n${sectionsHtml}\n    <!-- BUILD:CARDS:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(indexPath, next, "utf8");
  }
}

function main() {
  const zhArticles = findArticles();
  const enArticles = findEnglishArticles();

  zhArticles.forEach(updateArticleUpdatedMarker);
  zhArticles.forEach((a) => updateArticleCategoryLabel(a, CATEGORY_LABELS));
  enArticles.forEach(updateArticleUpdatedMarker);
  enArticles.forEach((a) => updateArticleCategoryLabel(a, CATEGORY_LABELS_EN));

  updateHomepageCards(zhArticles, path.join(ROOT, "index.html"), CATEGORY_LABELS);
  updateHomepageCards(enArticles, path.join(ROOT, "en", "index.html"), CATEGORY_LABELS_EN);

  updateAllSeo(zhArticles, enArticles);
  writeRobotsTxt();
  writeSitemap(zhArticles, enArticles);

  console.log(
    `Built ${zhArticles.length} Chinese article(s), ${enArticles.length} English article(s):`
  );
  zhArticles.forEach((a) => console.log(`  - ${a.dir} (updated ${a.updatedDate})`));
  enArticles.forEach((a) => console.log(`  - ${a.dir} (updated ${a.updatedDate})`));
}

main();
