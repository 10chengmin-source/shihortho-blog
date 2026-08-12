// Mirrors the locale set in scripts/build.js's LOCALES array. Kept as a
// small, independent copy here (Edge Functions run in Deno, not Node, and
// have no access to the repo's build step) rather than importing across
// runtimes — the two lists must be kept in sync by hand if locales ever
// change, which is rare and already true of the rest of this codebase's
// duplicated-by-design static-file architecture.
export const LOCALE_CODES = ["zh", "en", "zh-cn", "vi", "id"] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export const DEFAULT_LOCALE: LocaleCode = "zh";

export function isValidLocale(value: unknown): value is LocaleCode {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}

interface LocaleInfo {
  siteName: string;
  dir: string; // "" for the default locale (root), else the URL path segment
}

export const LOCALES: Record<LocaleCode, LocaleInfo> = {
  zh: { siteName: "背後的力量｜石醫師的骨科札記", dir: "" },
  en: { siteName: "Behind the Strength | Dr. Shih's Orthopedic Notes", dir: "en" },
  "zh-cn": { siteName: "背后的力量｜石医师的骨科札记", dir: "zh-cn" },
  vi: { siteName: "Sức Mạnh Đằng Sau | Nhật Ký Chỉnh Hình Của Bác Sĩ Shih", dir: "vi" },
  id: { siteName: "Kekuatan di Baliknya | Catatan Ortopedi Dr. Shih", dir: "id" },
};

export const SITE_URL = "https://drstone.daemet.com";

export function localePath(locale: LocaleCode, suffix = ""): string {
  const dir = LOCALES[locale].dir;
  return dir ? `${SITE_URL}/${dir}/${suffix}` : `${SITE_URL}/${suffix}`;
}

interface ConfirmEmailCopy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  ignoreNote: string;
}

interface NotificationEmailCopy {
  eyebrow: string;
  cta: string;
  unsubscribe: string;
}

// Draft copy — professional, minimal, matches the site's established
// fact-grounded, non-promotional tone. Flagged for the user's review before
// any real send goes out (see the project plan).
export const CONFIRM_EMAIL_COPY: Record<LocaleCode, ConfirmEmailCopy> = {
  zh: {
    subject: "確認訂閱｜背後的力量",
    heading: "確認訂閱",
    body: "請點擊下方按鈕確認訂閱。確認後，我們發布新文章時會寄信通知您。",
    cta: "確認訂閱",
    ignoreNote: "如果您沒有申請訂閱，請忽略這封信件，不會有任何影響。",
  },
  en: {
    subject: "Confirm your subscription | Behind the Strength",
    heading: "Confirm Your Subscription",
    body: "Click the button below to confirm your subscription. Once confirmed, we'll email you when a new article is published.",
    cta: "Confirm Subscription",
    ignoreNote: "If you didn't request this, you can safely ignore this email.",
  },
  "zh-cn": {
    subject: "确认订阅｜背后的力量",
    heading: "确认订阅",
    body: "请点击下方按钮确认订阅。确认后，我们发布新文章时会发邮件通知您。",
    cta: "确认订阅",
    ignoreNote: "如果您没有申请订阅，请忽略这封邮件，不会有任何影响。",
  },
  vi: {
    subject: "Xác nhận đăng ký | Sức Mạnh Đằng Sau",
    heading: "Xác Nhận Đăng Ký",
    body: "Nhấn vào nút bên dưới để xác nhận đăng ký. Sau khi xác nhận, chúng tôi sẽ gửi email khi có bài viết mới.",
    cta: "Xác Nhận Đăng Ký",
    ignoreNote: "Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.",
  },
  id: {
    subject: "Konfirmasi langganan | Kekuatan di Baliknya",
    heading: "Konfirmasi Langganan",
    body: "Klik tombol di bawah untuk mengonfirmasi langganan Anda. Setelah dikonfirmasi, kami akan mengirim email saat ada artikel baru.",
    cta: "Konfirmasi Langganan",
    ignoreNote: "Jika Anda tidak meminta ini, abaikan saja email ini.",
  },
};

export const NOTIFICATION_EMAIL_COPY: Record<LocaleCode, NotificationEmailCopy> = {
  zh: { eyebrow: "新文章", cta: "閱讀全文", unsubscribe: "取消訂閱" },
  en: { eyebrow: "New Article", cta: "Read the full article", unsubscribe: "Unsubscribe" },
  "zh-cn": { eyebrow: "新文章", cta: "阅读全文", unsubscribe: "取消订阅" },
  vi: { eyebrow: "Bài Viết Mới", cta: "Đọc toàn bộ bài viết", unsubscribe: "Hủy đăng ký" },
  id: { eyebrow: "Artikel Baru", cta: "Baca artikel lengkap", unsubscribe: "Berhenti berlangganan" },
};
