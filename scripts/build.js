const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

const CATEGORY_ORDER = [
  "philosophy",
  "announcement",
  "surgery",
  "education",
  "story",
];

// English eyebrow codes, used in the related-articles widget for locales
// whose relatedChipStyle is "code" (currently just "en") and as the "en"
// entry of CATEGORY_EYEBROW below.
const CATEGORY_CODES = {
  philosophy: "PHILOSOPHY",
  announcement: "ANNOUNCEMENT",
  surgery: "SURGERY",
  education: "EDUCATION",
  story: "CASE NOTES",
  uncategorized: "LATEST",
};

// Per-locale short eyebrow labels for the homepage section headers
// (.section-eyebrow). Deliberately in each locale's own language rather
// than English-only codes — an all-caps English word above a Chinese/
// Vietnamese/Indonesian heading reads as an untranslated leftover, not a
// design choice. Only "en" itself uses English. Non-English locales keep
// the same mono, uppercase-letterspaced treatment where the script has
// case (vi/id); Han-script locales just use short local words.
const CATEGORY_EYEBROW = {
  en: CATEGORY_CODES,
  zh: {
    philosophy: "理念",
    announcement: "公告",
    surgery: "手術室",
    education: "衛教",
    story: "故事",
    uncategorized: "最新",
  },
  "zh-cn": {
    philosophy: "理念",
    announcement: "公告",
    surgery: "手术室",
    education: "科普",
    story: "故事",
    uncategorized: "最新",
  },
  vi: {
    philosophy: "TRIẾT LÝ",
    announcement: "THÔNG BÁO",
    surgery: "PHẪU THUẬT",
    education: "KIẾN THỨC",
    story: "CÂU CHUYỆN",
    uncategorized: "MỚI NHẤT",
  },
  id: {
    philosophy: "FILOSOFI",
    announcement: "KABAR",
    surgery: "BEDAH",
    education: "EDUKASI",
    story: "KISAH",
    uncategorized: "TERBARU",
  },
};

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

const CATEGORY_LABELS_ZH_CN = {
  philosophy: "石医师的医疗理念",
  announcement: "石医师医疗团队动态",
  surgery: "石医师的手术室",
  education: "漫谈骨科",
  story: "临床小故事",
  uncategorized: "最新文章",
};

const CATEGORY_LABELS_VI = {
  philosophy: "Triết Lý Điều Trị Của Bác Sĩ Shih",
  announcement: "Tin Tức Phòng Khám",
  surgery: "Ghi Chép Phẫu Thuật",
  education: "Kiến Thức Chỉnh Hình",
  story: "Câu Chuyện Lâm Sàng",
  uncategorized: "Mới Nhất",
};

const CATEGORY_LABELS_ID = {
  philosophy: "Filosofi Perawatan Dr. Shih",
  announcement: "Kabar Klinik",
  surgery: "Catatan Bedah",
  education: "Wawasan Ortopedi",
  story: "Kisah Klinis",
  uncategorized: "Terbaru",
};

const SITE_URL = "https://drstone.daemet.com";
const SITE_NAME = "背後的力量｜石醫師的骨科札記";
const SITE_NAME_EN = "Behind the Strength | Dr. Shih's Orthopedic Notes";
const SITE_NAME_ZH_CN = "背后的力量｜石医师的骨科札记";
const SITE_NAME_VI = "Sức Mạnh Đằng Sau | Nhật Ký Chỉnh Hình Của Bác Sĩ Shih";
const SITE_NAME_ID = "Kekuatan di Baliknya | Catatan Ortopedi Dr. Shih";

const DOCTOR_NAME = "石承民";
const DOCTOR_NAME_EN = "Dr. Cheng-Min Shih";
const DOCTOR_NAME_ZH_CN = "石承民";
const DOCTOR_NAME_VI = "Bác sĩ Shih Cheng-Min";
const DOCTOR_NAME_ID = "Dr. Shih Cheng-Min";

const DEFAULT_OG_IMAGE = "/assets/images/hero-cover.jpg";
const DOCTOR_PORTRAIT = "/assets/images/doctor-portrait.jpg";

// Inline SVG globe icon for the lang-switch toggle, replacing a generic 🌐
// emoji — no external/paid icon set involved (project constraint: no
// paid icon packages), just a simple currentColor line icon that matches
// the button's own text color and its hover transition for free.
const LANG_SWITCH_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4.2 5.7 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.7-4.2-9S9.2 5.6 12 3z"/></svg>';

const HOME_DESCRIPTION_ZH =
  "石承民醫師的骨科札記，分享脊椎、關節與運動傷害相關的衛教知識、手術理念與臨床觀察。";
const HOME_DESCRIPTION_EN =
  "Dr. Cheng-Min Shih's orthopedic notes: clinical philosophy, surgical insights, and patient education on spine, joint, and sports-related conditions.";
const HOME_DESCRIPTION_ZH_CN =
  "石承民医师的骨科札记，分享脊柱、关节与运动损伤相关的健康科普知识、手术理念与临床观察。";
const HOME_DESCRIPTION_VI =
  "Nhật ký chỉnh hình của Bác sĩ Shih Cheng-Min: triết lý điều trị, kinh nghiệm phẫu thuật và kiến thức chăm sóc sức khỏe về cột sống, khớp và chấn thương thể thao.";
const HOME_DESCRIPTION_ID =
  "Catatan ortopedi Dr. Shih Cheng-Min: filosofi perawatan, wawasan bedah, dan edukasi pasien seputar tulang belakang, sendi, dan cedera olahraga.";

const ABOUT_TITLE_ZH = `醫師介紹｜${DOCTOR_NAME} 醫師｜背後的力量`;
const ABOUT_TITLE_EN = "About Dr. Shih | Behind the Strength";
const ABOUT_TITLE_ZH_CN = "医师介绍｜石承民医师｜背后的力量";
const ABOUT_TITLE_VI = "Giới Thiệu Bác Sĩ Shih | Sức Mạnh Đằng Sau";
const ABOUT_TITLE_ID = "Tentang Dr. Shih | Kekuatan di Baliknya";

const ABOUT_DESCRIPTION_ZH =
  "石承民醫師，臺中榮民總醫院骨科部脊椎外科科主任，專長涵蓋各式微創、複雜及脊椎翻修手術、膝髖關節重建手術與骨質疏鬆治療。";
const ABOUT_DESCRIPTION_EN =
  "Dr. Cheng-Min Shih, Chief of the Division of Spine Surgery, Department of Orthopedics, Taichung Veterans General Hospital. Specializing in minimally invasive, complex, and revision spine surgery, hip and knee reconstruction, and osteoporosis care.";
const ABOUT_DESCRIPTION_ZH_CN =
  "石承民医师，台中荣民总医院骨科部脊柱外科主任，专长涵盖各类微创、复杂及脊柱翻修手术、膝髋关节重建手术与骨质疏松治疗。";
const ABOUT_DESCRIPTION_VI =
  "Bác sĩ Shih Cheng-Min, Trưởng khoa Phẫu thuật Cột sống, Khoa Chỉnh hình, Bệnh viện Cựu chiến binh Đài Trung. Chuyên về phẫu thuật cột sống xâm lấn tối thiểu, phức tạp và tái phẫu thuật, tái tạo khớp háng và khớp gối, cùng điều trị loãng xương.";
const ABOUT_DESCRIPTION_ID =
  "Dr. Shih Cheng-Min, Kepala Divisi Bedah Tulang Belakang, Departemen Ortopedi, Rumah Sakit Umum Veteran Taichung. Berfokus pada bedah tulang belakang minim sayatan, kompleks, dan revisi, rekonstruksi sendi panggul dan lutut, serta penanganan osteoporosis.";

// Draft copy — review before shipping, matches the site's quiet,
// fact-grounded tone (not marketing language). Same fields as
// _shared/locales.ts's confirm/notification email copy, but for the
// on-page subscribe form + confirm/unsubscribe landing pages.
const SUBSCRIBE_COPY_ZH = {
  label: "文章通知",
  heading: "訂閱新文章通知",
  desc: "新文章發布時，以電子郵件通知您，可隨時取消訂閱。",
  placeholder: "電子郵件",
  submit: "訂閱",
  success: "感謝訂閱，請至信箱點擊確認連結完成訂閱。",
  error: "訂閱時發生問題，請稍後再試。",
  invalid: "請輸入有效的電子郵件地址。",
  confirmedHeading: "訂閱確認",
  confirmedSuccess: "您已成功訂閱新文章通知。",
  confirmedError: "確認連結無效或已過期，請重新訂閱。",
  unsubscribedHeading: "取消訂閱",
  unsubscribedSuccess: "您已取消訂閱，將不再收到新文章通知。",
  unsubscribedError: "連結無效，請確認網址是否完整。",
  backLink: "回首頁",
};

const SUBSCRIBE_COPY_EN = {
  label: "Article Updates",
  heading: "Get notified about new articles",
  desc: "Receive an email when a new article is published. Unsubscribe anytime.",
  placeholder: "Email address",
  submit: "Subscribe",
  success: "Thanks — check your inbox to confirm your subscription.",
  error: "Something went wrong. Please try again later.",
  invalid: "Please enter a valid email address.",
  confirmedHeading: "Confirm Subscription",
  confirmedSuccess: "You're subscribed to new article notifications.",
  confirmedError: "This confirmation link is invalid or expired — please subscribe again.",
  unsubscribedHeading: "Unsubscribe",
  unsubscribedSuccess: "You've been unsubscribed and won't receive further notifications.",
  unsubscribedError: "This link is invalid — please check the URL.",
  backLink: "Back to home",
};

const SUBSCRIBE_COPY_ZH_CN = {
  label: "文章通知",
  heading: "订阅新文章通知",
  desc: "新文章发布时，以电子邮件通知您，可随时取消订阅。",
  placeholder: "电子邮件",
  submit: "订阅",
  success: "感谢订阅，请至邮箱点击确认链接完成订阅。",
  error: "订阅时发生问题，请稍后再试。",
  invalid: "请输入有效的电子邮件地址。",
  confirmedHeading: "订阅确认",
  confirmedSuccess: "您已成功订阅新文章通知。",
  confirmedError: "确认链接无效或已过期，请重新订阅。",
  unsubscribedHeading: "取消订阅",
  unsubscribedSuccess: "您已取消订阅，将不再收到新文章通知。",
  unsubscribedError: "链接无效，请确认网址是否完整。",
  backLink: "回首页",
};

const SUBSCRIBE_COPY_VI = {
  label: "Thông Báo Bài Viết",
  heading: "Nhận thông báo bài viết mới",
  desc: "Chúng tôi sẽ gửi email khi có bài viết mới. Bạn có thể hủy đăng ký bất cứ lúc nào.",
  placeholder: "Địa chỉ email",
  submit: "Đăng ký",
  success: "Cảm ơn bạn — vui lòng kiểm tra hộp thư để xác nhận đăng ký.",
  error: "Đã xảy ra lỗi. Vui lòng thử lại sau.",
  invalid: "Vui lòng nhập địa chỉ email hợp lệ.",
  confirmedHeading: "Xác Nhận Đăng Ký",
  confirmedSuccess: "Bạn đã đăng ký nhận thông báo bài viết mới thành công.",
  confirmedError: "Liên kết xác nhận không hợp lệ hoặc đã hết hạn — vui lòng đăng ký lại.",
  unsubscribedHeading: "Hủy Đăng Ký",
  unsubscribedSuccess: "Bạn đã hủy đăng ký và sẽ không nhận thêm thông báo.",
  unsubscribedError: "Liên kết không hợp lệ — vui lòng kiểm tra lại URL.",
  backLink: "Về trang chủ",
};

const SUBSCRIBE_COPY_ID = {
  label: "Pemberitahuan Artikel",
  heading: "Dapatkan pemberitahuan artikel baru",
  desc: "Kami akan mengirim email saat ada artikel baru. Anda dapat berhenti berlangganan kapan saja.",
  placeholder: "Alamat email",
  submit: "Berlangganan",
  success: "Terima kasih — silakan periksa kotak masuk untuk mengonfirmasi langganan Anda.",
  error: "Terjadi kesalahan. Silakan coba lagi nanti.",
  invalid: "Silakan masukkan alamat email yang valid.",
  confirmedHeading: "Konfirmasi Langganan",
  confirmedSuccess: "Anda telah berhasil berlangganan pemberitahuan artikel baru.",
  confirmedError: "Tautan konfirmasi tidak valid atau telah kedaluwarsa — silakan berlangganan lagi.",
  unsubscribedHeading: "Berhenti Berlangganan",
  unsubscribedSuccess: "Anda telah berhenti berlangganan dan tidak akan menerima pemberitahuan lagi.",
  unsubscribedError: "Tautan tidak valid — silakan periksa kembali URL-nya.",
  backLink: "Kembali ke beranda",
};

// Every locale-aware function in this file reads from LOCALES instead of
// hand-duplicating a branch per language. To add a locale: add an entry
// here, create its directory with the same shape as en/, and re-run the
// build — every generation step (SEO, sitemap, RSS, related-articles,
// friend-links, lang-switch) picks it up automatically. Entries whose
// directory doesn't exist on disk yet are silently skipped everywhere via
// fs.existsSync guards, so adding metadata ahead of content is safe.
const LOCALES = [
  {
    code: "zh",
    dir: "",
    isDefault: true,
    htmlLang: "zh-Hant",
    hreflang: "zh-Hant",
    ogLocale: "zh_TW",
    inLanguage: "zh-Hant-TW",
    rssLanguage: "zh-tw",
    siteName: SITE_NAME,
    doctorName: DOCTOR_NAME,
    homeDescription: HOME_DESCRIPTION_ZH,
    rssDescription: HOME_DESCRIPTION_ZH,
    aboutTitle: ABOUT_TITLE_ZH,
    aboutDescription: ABOUT_DESCRIPTION_ZH,
    hospitalName: "臺中榮民總醫院",
    alumniOf: ["陽明交通大學", "高雄醫學大學"],
    categoryLabels: CATEGORY_LABELS,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "中文",
    subscribeCopy: SUBSCRIBE_COPY_ZH,
  },
  {
    code: "en",
    dir: "en",
    isDefault: false,
    htmlLang: "en",
    hreflang: "en",
    ogLocale: "en_US",
    inLanguage: "en",
    rssLanguage: "en-us",
    siteName: SITE_NAME_EN,
    doctorName: DOCTOR_NAME_EN,
    homeDescription: HOME_DESCRIPTION_EN,
    rssDescription: HOME_DESCRIPTION_EN,
    aboutTitle: ABOUT_TITLE_EN,
    aboutDescription: ABOUT_DESCRIPTION_EN,
    hospitalName: "Taichung Veterans General Hospital",
    alumniOf: ["National Yang Ming Chiao Tung University", "Kaohsiung Medical University"],
    categoryLabels: CATEGORY_LABELS_EN,
    relatedChipStyle: "code",
    langSwitchSelfLabel: "English",
    subscribeCopy: SUBSCRIBE_COPY_EN,
  },
  {
    code: "zh-cn",
    dir: "zh-cn",
    isDefault: false,
    htmlLang: "zh-CN",
    hreflang: "zh-CN",
    ogLocale: "zh_CN",
    inLanguage: "zh-Hans-CN",
    rssLanguage: "zh-cn",
    siteName: SITE_NAME_ZH_CN,
    doctorName: DOCTOR_NAME_ZH_CN,
    homeDescription: HOME_DESCRIPTION_ZH_CN,
    rssDescription: HOME_DESCRIPTION_ZH_CN,
    aboutTitle: ABOUT_TITLE_ZH_CN,
    aboutDescription: ABOUT_DESCRIPTION_ZH_CN,
    hospitalName: "台中荣民总医院",
    alumniOf: ["阳明交通大学", "高雄医学大学"],
    categoryLabels: CATEGORY_LABELS_ZH_CN,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "简体中文",
    subscribeCopy: SUBSCRIBE_COPY_ZH_CN,
  },
  {
    code: "vi",
    dir: "vi",
    isDefault: false,
    htmlLang: "vi",
    hreflang: "vi",
    ogLocale: "vi_VN",
    inLanguage: "vi",
    rssLanguage: "vi",
    siteName: SITE_NAME_VI,
    doctorName: DOCTOR_NAME_VI,
    homeDescription: HOME_DESCRIPTION_VI,
    rssDescription: HOME_DESCRIPTION_VI,
    aboutTitle: ABOUT_TITLE_VI,
    aboutDescription: ABOUT_DESCRIPTION_VI,
    hospitalName: "Bệnh viện Cựu chiến binh Đài Trung",
    alumniOf: ["Đại học Quốc lập Dương Minh Giao Thông", "Đại học Y khoa Cao Hùng"],
    categoryLabels: CATEGORY_LABELS_VI,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "Tiếng Việt",
    subscribeCopy: SUBSCRIBE_COPY_VI,
  },
  {
    code: "id",
    dir: "id",
    isDefault: false,
    htmlLang: "id",
    hreflang: "id",
    ogLocale: "id_ID",
    inLanguage: "id",
    rssLanguage: "id",
    siteName: SITE_NAME_ID,
    doctorName: DOCTOR_NAME_ID,
    homeDescription: HOME_DESCRIPTION_ID,
    rssDescription: HOME_DESCRIPTION_ID,
    aboutTitle: ABOUT_TITLE_ID,
    aboutDescription: ABOUT_DESCRIPTION_ID,
    hospitalName: "Rumah Sakit Umum Veteran Taichung",
    alumniOf: ["Universitas Nasional Yang Ming Chiao Tung", "Universitas Kedokteran Kaohsiung"],
    categoryLabels: CATEGORY_LABELS_ID,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "Bahasa Indonesia",
    subscribeCopy: SUBSCRIBE_COPY_ID,
  },
];
const LOCALES_BY_CODE = Object.fromEntries(LOCALES.map((l) => [l.code, l]));
const DEFAULT_LOCALE = LOCALES.find((l) => l.isDefault);

// Static page directories that exist once per locale (not blog articles).
const PAGE_DIRS = new Set(["about", "media", "line"]);
// Everything the root (default-locale) article scan must skip: the static
// page dirs, non-content tooling dirs, and every other locale's directory.
const ROOT_IGNORE_DIRS = new Set([
  ...PAGE_DIRS,
  "assets",
  "scripts",
  "node_modules",
  ".git",
  ".github",
  "dist",
  "supabase",
  "subscribe",
  "idea-capture-9b0436e5ce39ba5884a3cb1f18952684",
  ...LOCALES.filter((l) => l.dir).map((l) => l.dir),
]);

function localeUrl(locale, suffix = "") {
  return locale.dir ? `${SITE_URL}/${locale.dir}/${suffix}` : `${SITE_URL}/${suffix}`;
}

function localePath(locale, suffix = "") {
  return locale.dir ? `/${locale.dir}/${suffix}` : `/${suffix}`;
}

// Partner / collaborator links shown in every page's footer.
// Add future collaborators here — one `labels` entry per locale, plus the url.
const FRIEND_LINKS = [
  {
    labels: {
      zh: "背後的力量 Facebook 粉絲專頁",
      en: "Behind the Strength on Facebook",
      "zh-cn": "背后的力量 Facebook 主页",
      vi: "Trang Facebook Sức Mạnh Đằng Sau",
      id: "Halaman Facebook Kekuatan di Baliknya",
    },
    url: "https://www.facebook.com/profile.php?id=61581620385517",
  },
];

const FRIEND_LINKS_HEADING = {
  zh: "友好連結",
  en: "Partner Links",
  "zh-cn": "友情链接",
  vi: "Liên Kết Đối Tác",
  id: "Tautan Mitra",
};

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

    const publishedMs = publishedDate ? new Date(publishedDate).getTime() : NaN;
    const isNew = !Number.isNaN(publishedMs) && Date.now() - publishedMs < NEW_BADGE_WINDOW_MS;

    // Homepage list thumbnail: only for articles that already have a real
    // hero photo (class="post-hero-img"), reusing a pre-generated -thumb.jpg
    // sibling if one exists. Articles without a photo (most of the
    // philosophy/education pieces) simply render without a thumbnail —
    // deliberately not auto-generating a placeholder for those.
    let thumbnail = null;
    const heroMatch = html.match(/class="post-hero-img"[\s\S]*?src="\/assets\/images\/([^"]+)\.jpg"/);
    if (heroMatch) {
      const thumbPath = path.join(ROOT, "assets", "images", `${heroMatch[1]}-thumb.jpg`);
      if (fs.existsSync(thumbPath)) thumbnail = `/assets/images/${heroMatch[1]}-thumb.jpg`;
    }

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
      isNew,
      thumbnail,
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

function findAllArticles() {
  const result = {};
  for (const locale of LOCALES) {
    const baseDir = locale.dir ? path.join(ROOT, locale.dir) : ROOT;
    const ignoreDirs = locale.isDefault ? ROOT_IGNORE_DIRS : PAGE_DIRS;
    const dirPrefix = locale.dir ? locale.dir + "/" : "";
    result[locale.code] = findArticlesIn(baseDir, ignoreDirs, dirPrefix);
  }
  return result;
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
  const loc = LOCALES_BY_CODE[locale];
  return [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${escapeHtml(loc.siteName)}" />`,
    `<meta property="og:locale" content="${loc.ogLocale}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
}

// Accepts a sparse {localeCode: url} map and emits one alternate tag per
// present locale (in LOCALES order) plus one x-default pointing at the
// default locale's URL.
function hreflangTags(urlsByLocale) {
  const tags = [];
  for (const locale of LOCALES) {
    const url = urlsByLocale[locale.code];
    if (url) tags.push(`<link rel="alternate" hreflang="${locale.hreflang}" href="${url}" />`);
  }
  const defaultUrl = urlsByLocale[DEFAULT_LOCALE.code];
  if (defaultUrl) tags.push(`<link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`);
  return tags;
}

function buildArticleSeo(article, html, locale, counterpartsByLocale) {
  const loc = LOCALES_BY_CODE[locale];
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

  const urlsByLocale = {};
  for (const l of LOCALES) {
    if (l.code === locale) {
      urlsByLocale[l.code] = url;
    } else if (counterpartsByLocale && counterpartsByLocale[l.code]) {
      urlsByLocale[l.code] = `${SITE_URL}/${counterpartsByLocale[l.code].dir}/`;
    }
  }
  tags.push(...hreflangTags(urlsByLocale));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    headline: article.title,
    description: article.excerpt,
    image,
    author: {
      "@type": "Person",
      name: article.author || loc.doctorName,
    },
    publisher: {
      "@type": "Organization",
      name: loc.siteName,
      logo: { "@type": "ImageObject", url: SITE_URL + DOCTOR_PORTRAIT },
    },
    datePublished: article.publishedDate,
    dateModified: article.updatedDate,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: loc.inLanguage,
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildHomeSeo(locale) {
  const loc = LOCALES_BY_CODE[locale];
  const url = localeUrl(loc);
  const image = SITE_URL + DEFAULT_OG_IMAGE;
  const tags = commonOgTags({
    title: loc.siteName,
    description: loc.homeDescription,
    url,
    image,
    type: "website",
    locale,
  });

  const urlsByLocale = {};
  for (const l of LOCALES) {
    if (fs.existsSync(path.join(ROOT, l.dir, "index.html"))) {
      urlsByLocale[l.code] = localeUrl(l);
    }
  }
  tags.push(...hreflangTags(urlsByLocale));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: loc.siteName,
    url,
    description: loc.homeDescription,
    inLanguage: loc.inLanguage,
    publisher: {
      "@type": "Physician",
      name: loc.doctorName,
      medicalSpecialty: "https://schema.org/Orthopedic",
      image: SITE_URL + DOCTOR_PORTRAIT,
      url,
    },
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildAboutSeo(locale) {
  const loc = LOCALES_BY_CODE[locale];
  const url = localeUrl(loc, "about/");
  const image = SITE_URL + DOCTOR_PORTRAIT;
  const tags = commonOgTags({
    title: loc.aboutTitle,
    description: loc.aboutDescription,
    url,
    image,
    type: "profile",
    locale,
  });

  const urlsByLocale = {};
  for (const l of LOCALES) {
    if (fs.existsSync(path.join(ROOT, l.dir, "about", "index.html"))) {
      urlsByLocale[l.code] = localeUrl(l, "about/");
    }
  }
  tags.push(...hreflangTags(urlsByLocale));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: loc.doctorName,
    image,
    url,
    medicalSpecialty: "https://schema.org/Orthopedic",
    worksFor: { "@type": "Hospital", name: loc.hospitalName },
    alumniOf: loc.alumniOf,
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

function buildSlugMap(articlesByLocale) {
  const map = new Map();
  for (const locale of LOCALES) {
    for (const a of articlesByLocale[locale.code]) {
      if (!map.has(a.slug)) map.set(a.slug, {});
      map.get(a.slug)[locale.code] = a;
    }
  }
  return map;
}

function updateAllSeo(articlesByLocale) {
  for (const locale of LOCALES) {
    injectSeo(path.join(ROOT, locale.dir, "index.html"), buildHomeSeo(locale.code));
    injectSeo(path.join(ROOT, locale.dir, "about", "index.html"), buildAboutSeo(locale.code));
  }

  const slugMap = buildSlugMap(articlesByLocale);
  for (const locale of LOCALES) {
    for (const article of articlesByLocale[locale.code]) {
      const html = fs.readFileSync(article.indexPath, "utf8");
      const counterparts = slugMap.get(article.slug) || {};
      injectSeo(article.indexPath, buildArticleSeo(article, html, locale.code, counterparts));
    }
  }
}

function writeRobotsTxt() {
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, "robots.txt"), content, "utf8");
}

function writeSitemap(articlesByLocale) {
  const staticPages = [
    { file: "index.html", suffix: "", priority: "1.0" },
    { file: path.join("about", "index.html"), suffix: "about/", priority: "0.8" },
    { file: path.join("media", "index.html"), suffix: "media/", priority: "0.6" },
    { file: path.join("line", "index.html"), suffix: "line/", priority: "0.4" },
  ];

  const staticUrls = [];
  for (const locale of LOCALES) {
    for (const page of staticPages) {
      const filePath = path.join(ROOT, locale.dir, page.file);
      if (locale.isDefault || fs.existsSync(filePath)) {
        staticUrls.push({ loc: localeUrl(locale, page.suffix), priority: page.priority });
      }
    }
  }

  const articleUrls = LOCALES.flatMap((l) => articlesByLocale[l.code]).map((a) => ({
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

function renderIndexRow(article, indexInGroup, locale) {
  const num = String(indexInGroup).padStart(2, "0");
  const newBadge = article.isNew
    ? `\n              <span class="index-badge-new">${escapeHtml(
        NEW_BADGE_LABEL[locale]
      )}</span>`
    : "";
  const thumb = article.thumbnail
    ? `<img class="index-thumb" src="${article.thumbnail}" alt="" width="100" height="70" loading="lazy" />\n            `
    : "";
  const linkClass = article.thumbnail ? "index-link index-link-with-thumb" : "index-link";
  return `        <div class="index-row">
          <span class="index-num">${num}</span>
          <a href="/${article.dir}/" class="${linkClass}">
            ${thumb}<div class="index-body">
              <h3 class="index-title">${escapeHtml(article.title)}</h3>
              <p class="index-excerpt">${escapeHtml(article.excerpt)}</p>
              <div class="index-meta">
                <span class="index-date">${article.updatedDate}</span>${newBadge}
              </div>
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

function renderSection(group, locale) {
  const rowsHtml = group.articles
    .map((article, i) => renderIndexRow(article, i + 1, locale))
    .join("\n");
  const eyebrows = CATEGORY_EYEBROW[locale] || CATEGORY_CODES;
  const code = eyebrows[group.key] || eyebrows.uncategorized;
  return `    <section class="category-section" id="${escapeHtml(group.key)}">
      <span class="section-eyebrow">${escapeHtml(code)}</span>
      <h2 class="section-title">${escapeHtml(group.label)}</h2>
      <div class="index-list">
${rowsHtml}
      </div>
    </section>`;
}

const RELATED_HEADING = {
  zh: "延伸閱讀",
  en: "Further Reading",
  "zh-cn": "延伸阅读",
  vi: "Đọc Thêm",
  id: "Baca Juga",
};

// Articles published within this window show a "NEW" badge on the homepage
// instead of a view count (a freshly-published article's real view count is
// low by definition, which read as "nobody reads this" rather than "just
// published" — a badge signals the same thing without the discouraging number).
const NEW_BADGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const NEW_BADGE_LABEL = {
  zh: "最新",
  en: "New",
  "zh-cn": "最新",
  vi: "Mới",
  id: "Baru",
};

function pickRelated(article, allArticles, count = 3) {
  const others = allArticles.filter((a) => a !== article);
  const sameCategory = others.filter((a) => a.category === article.category);
  const rest = others.filter((a) => a.category !== article.category);
  return [...sameCategory, ...rest].slice(0, count);
}

function renderRelated(article, allArticles, locale) {
  const related = pickRelated(article, allArticles);
  if (!related.length) return "";
  const loc = LOCALES_BY_CODE[locale];
  const codes = loc.relatedChipStyle === "code" ? CATEGORY_CODES : loc.categoryLabels;
  const rowsHtml = related
    .map(
      (a) => `        <a href="/${a.dir}/" class="related-link">
          <span class="related-category">${escapeHtml(
            codes[a.category] || codes.uncategorized
          )}</span>
          <h4 class="related-title">${escapeHtml(a.title)}</h4>
        </a>`
    )
    .join("\n");
  return `      <aside class="related-articles">
        <h3 class="related-heading">${RELATED_HEADING[locale]}</h3>
        <div class="related-list">
${rowsHtml}
        </div>
      </aside>`;
}

function injectRelated(article, allArticles, locale) {
  const filePath = article.indexPath;
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:RELATED:START -->[\s\S]*?<!-- BUILD:RELATED:END -->/;
  if (!re.test(html)) return;
  const relatedHtml = renderRelated(article, allArticles, locale);
  const inner = relatedHtml
    ? `<!-- BUILD:RELATED:START -->\n${relatedHtml}\n      <!-- BUILD:RELATED:END -->`
    : `<!-- BUILD:RELATED:START -->\n      <!-- BUILD:RELATED:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildRssItems(articles) {
  return articles
    .map((a) => {
      const url = `${SITE_URL}/${a.dir}/`;
      const pubDate = new Date(`${a.publishedDate}T09:00:00+08:00`).toUTCString();
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(a.excerpt)}</description>
    </item>`;
    })
    .join("\n");
}

function writeRssFeed(articles, locale) {
  const loc = LOCALES_BY_CODE[locale];
  const siteUrl = localeUrl(loc);
  const feedUrl = `${siteUrl}rss.xml`;
  const itemsXml = buildRssItems(articles);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(loc.siteName)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(loc.rssDescription)}</description>
    <language>${loc.rssLanguage}</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>
`;
  const outPath = path.join(ROOT, loc.dir, "rss.xml");
  fs.writeFileSync(outPath, xml, "utf8");
}

function renderFriendLinks(locale) {
  if (!FRIEND_LINKS.length) return "";
  const linksHtml = FRIEND_LINKS.map((f) => {
    const label = f.labels[locale] || f.labels.en || f.labels.zh;
    return `<a href="${f.url}" target="_blank" rel="noopener">${escapeHtml(
      label
    )}</a>`;
  }).join("\n        ");
  return `      <div class="friend-links">
        <span class="friend-links-label">${FRIEND_LINKS_HEADING[locale]}</span>
        ${linksHtml}
      </div>`;
}

function injectFriendLinks(filePath, locale) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:FRIENDS:START -->[\s\S]*?<!-- BUILD:FRIENDS:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:FRIENDS:START -->\n${renderFriendLinks(
    locale
  )}\n      <!-- BUILD:FRIENDS:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function renderSubscribeForm(localeCode) {
  const copy = LOCALES_BY_CODE[localeCode].subscribeCopy;
  return `      <div class="subscribe-block">
        <span class="subscribe-block-label">${escapeHtml(copy.label)}</span>
        <h2 class="subscribe-block-heading">${escapeHtml(copy.heading)}</h2>
        <p class="subscribe-block-desc">${escapeHtml(copy.desc)}</p>
        <form class="subscribe-form" data-locale="${localeCode}" data-success-msg="${escapeHtml(
    copy.success
  )}" data-error-msg="${escapeHtml(copy.error)}" data-invalid-msg="${escapeHtml(copy.invalid)}">
          <div class="subscribe-honeypot" aria-hidden="true">
            <label for="subscribe-website">Website</label>
            <input type="text" id="subscribe-website" name="website" tabindex="-1" autocomplete="off" />
          </div>
          <input type="email" class="subscribe-input" name="email" placeholder="${escapeHtml(
            copy.placeholder
          )}" aria-label="${escapeHtml(copy.placeholder)}" required />
          <button type="submit" class="subscribe-submit">${escapeHtml(copy.submit)}</button>
        </form>
        <p class="subscribe-status" role="status" aria-live="polite"></p>
      </div>`;
}

function injectSubscribeForm(filePath, localeCode) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:SUBSCRIBE:START -->[\s\S]*?<!-- BUILD:SUBSCRIBE:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:SUBSCRIBE:START -->\n${renderSubscribeForm(
    localeCode
  )}\n      <!-- BUILD:SUBSCRIBE:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

// availability is a sparse {localeCode: relativeUrl} map for this exact
// page (a static page or a specific article's counterparts). A locale
// missing from the map renders as a disabled, unclickable entry instead of
// a link to a page that doesn't exist yet.
function renderLangSwitch(currentLocaleCode, availability) {
  const current = LOCALES_BY_CODE[currentLocaleCode];
  const itemsHtml = LOCALES.map((l) => {
    const href = availability[l.code];
    if (l.code === currentLocaleCode) {
      return `          <a href="${href}" aria-current="true">${escapeHtml(
        l.langSwitchSelfLabel
      )}</a>`;
    }
    if (href) {
      return `          <a href="${href}">${escapeHtml(l.langSwitchSelfLabel)}</a>`;
    }
    return `          <span class="lang-switch-disabled" aria-disabled="true">${escapeHtml(
      l.langSwitchSelfLabel
    )}</span>`;
  }).join("\n");

  return `<div class="lang-switch">
        <button type="button" class="lang-switch-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="lang-switch-menu"><span class="lang-switch-icon" aria-hidden="true">${LANG_SWITCH_ICON_SVG}</span>${escapeHtml(
          current.langSwitchSelfLabel
        )}</button>
        <div class="lang-switch-menu" id="lang-switch-menu">
${itemsHtml}
        </div>
      </div>`;
}

function injectLangSwitch(filePath, currentLocaleCode, availability) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:LANGSWITCH:START -->[\s\S]*?<!-- BUILD:LANGSWITCH:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:LANGSWITCH:START -->${renderLangSwitch(
    currentLocaleCode,
    availability
  )}<!-- BUILD:LANGSWITCH:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

// Computes a {localeCode: relativeUrl} map for one static page type (home,
// about, media, or line) by checking which locales actually have that file.
function staticPageAvailability(pageFile, suffix) {
  const availability = {};
  for (const l of LOCALES) {
    if (fs.existsSync(path.join(ROOT, l.dir, pageFile))) {
      availability[l.code] = localePath(l, suffix);
    }
  }
  return availability;
}

function updateHomepageCards(articles, indexPath, labels, locale) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");
  const re = /<!-- BUILD:CARDS:START -->[\s\S]*?<!-- BUILD:CARDS:END -->/;
  if (!re.test(html)) {
    throw new Error(`BUILD:CARDS markers not found in ${indexPath}`);
  }
  const groups = groupByCategory(articles, labels);
  const sectionsHtml = groups.map((group) => renderSection(group, locale)).join("\n\n");
  const replacement = `<!-- BUILD:CARDS:START -->\n${sectionsHtml}\n    <!-- BUILD:CARDS:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(indexPath, next, "utf8");
  }
}

// Static assets (CSS/JS/hero image) are served with a long browser cache
// (Cache-Control: max-age=14400) and no per-file versioning, so a deploy
// alone doesn't make already-cached visitors see the change for up to 4
// hours. Appending a content-derived ?v= query string to every reference
// changes the URL whenever the underlying file changes, which busts the
// cache immediately without needing to touch Cloudflare's cache settings.
const VERSIONED_ASSETS = [
  "assets/css/style.css",
  "assets/js/supabase-config.js",
  "assets/js/counter.js",
  "assets/js/subscribe.js",
  "assets/js/subscribe-action.js",
  "assets/js/adaptive-reading.js",
  "assets/js/mobile-nav.js",
  "assets/js/lang-switch.js",
  "assets/images/hero-cover.jpg",
  "assets/images/hero-cover.webp",
];

function computeAssetVersion() {
  const hash = crypto.createHash("md5");
  for (const rel of VERSIONED_ASSETS) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) hash.update(fs.readFileSync(abs));
  }
  return hash.digest("hex").slice(0, 10);
}

// Directories whose HTML is intentionally left out of asset versioning:
// idea-capture-* is a private, unlisted page that must not be touched by
// any automated pass (see CLAUDE.md), and the usual build-output/tooling
// dirs aren't page content at all.
const VERSIONING_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  "dist",
  "supabase",
  "scripts",
  "assets",
]);

function findAllHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (VERSIONING_SKIP_DIRS.has(entry.name) || entry.name.startsWith("idea-capture-")) continue;
      results.push(...findAllHtmlFiles(path.join(dir, entry.name)));
    } else if (entry.name === "index.html") {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function applyAssetVersion(filePath, version) {
  let html = fs.readFileSync(filePath, "utf8");
  const before = html;
  for (const rel of VERSIONED_ASSETS) {
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(["'/]${escaped})(\\?v=[a-f0-9]+)?(["'])`, "g");
    html = html.replace(re, `$1?v=${version}$3`);
  }
  if (html !== before) fs.writeFileSync(filePath, html, "utf8");
}

function versionAllAssets() {
  const version = computeAssetVersion();
  const files = findAllHtmlFiles(ROOT);
  files.forEach((f) => applyAssetVersion(f, version));
  console.log(`Applied asset version ?v=${version} to ${files.length} page(s).`);
}

function main() {
  const articlesByLocale = findAllArticles();

  for (const locale of LOCALES) {
    const articles = articlesByLocale[locale.code];
    articles.forEach(updateArticleUpdatedMarker);
    articles.forEach((a) => updateArticleCategoryLabel(a, locale.categoryLabels));
    updateHomepageCards(
      articles,
      path.join(ROOT, locale.dir, "index.html"),
      locale.categoryLabels,
      locale.code
    );
    articles.forEach((a) => injectRelated(a, articles, locale.code));
  }

  for (const locale of LOCALES) {
    injectFriendLinks(path.join(ROOT, locale.dir, "index.html"), locale.code);
    injectFriendLinks(path.join(ROOT, locale.dir, "about", "index.html"), locale.code);
    injectFriendLinks(path.join(ROOT, locale.dir, "media", "index.html"), locale.code);
    injectFriendLinks(path.join(ROOT, locale.dir, "line", "index.html"), locale.code);
    articlesByLocale[locale.code].forEach((a) => injectFriendLinks(a.indexPath, locale.code));

    // Homepage lower-middle + bottom of every article page only — not the
    // about/media/line static pages.
    injectSubscribeForm(path.join(ROOT, locale.dir, "index.html"), locale.code);
    articlesByLocale[locale.code].forEach((a) => injectSubscribeForm(a.indexPath, locale.code));
  }

  const homeAvailability = staticPageAvailability("index.html", "");
  const aboutAvailability = staticPageAvailability(path.join("about", "index.html"), "about/");
  const mediaAvailability = staticPageAvailability(path.join("media", "index.html"), "media/");
  const lineAvailability = staticPageAvailability(path.join("line", "index.html"), "line/");
  const slugMap = buildSlugMap(articlesByLocale);

  for (const locale of LOCALES) {
    injectLangSwitch(path.join(ROOT, locale.dir, "index.html"), locale.code, homeAvailability);
    injectLangSwitch(
      path.join(ROOT, locale.dir, "about", "index.html"),
      locale.code,
      aboutAvailability
    );
    injectLangSwitch(
      path.join(ROOT, locale.dir, "media", "index.html"),
      locale.code,
      mediaAvailability
    );
    injectLangSwitch(path.join(ROOT, locale.dir, "line", "index.html"), locale.code, lineAvailability);

    articlesByLocale[locale.code].forEach((a) => {
      const counterparts = slugMap.get(a.slug) || {};
      const availability = {};
      for (const l of LOCALES) {
        if (counterparts[l.code]) availability[l.code] = `/${counterparts[l.code].dir}/`;
      }
      injectLangSwitch(a.indexPath, locale.code, availability);
    });
  }

  updateAllSeo(articlesByLocale);
  writeRobotsTxt();
  writeSitemap(articlesByLocale);
  for (const locale of LOCALES) {
    if (locale.isDefault || fs.existsSync(path.join(ROOT, locale.dir))) {
      writeRssFeed(articlesByLocale[locale.code], locale.code);
    }
  }

  versionAllAssets();

  console.log(`Built ${LOCALES.length} configured locale(s):`);
  for (const locale of LOCALES) {
    const articles = articlesByLocale[locale.code];
    console.log(`  ${locale.code}: ${articles.length} article(s)`);
    articles.forEach((a) => console.log(`    - ${a.dir} (updated ${a.updatedDate})`));
  }
}

main();
