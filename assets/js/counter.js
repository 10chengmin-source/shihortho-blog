(function () {
  const config = window.SUPABASE_CONFIG;
  if (!config || !config.url || config.url.indexOf("PLACEHOLDER") !== -1) {
    return;
  }

  const headers = {
    apikey: config.anonKey,
    Authorization: "Bearer " + config.anonKey,
    "Content-Type": "application/json",
  };

  const isEn = document.documentElement.lang.indexOf("en") === 0;
  const numberLocale = isEn ? "en-US" : "zh-Hant";

  async function fetchAllCounts() {
    const res = await fetch(
      config.url + "/rest/v1/page_views?select=slug,views",
      { headers }
    );
    if (!res.ok) return [];
    return res.json();
  }

  async function incrementCount(slug) {
    const res = await fetch(
      config.url + "/rest/v1/rpc/increment_page_view",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ slug_input: slug }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data === "number" ? data : data && data.views;
  }

  // Per-article counts are still tracked (increment on view, summed into the
  // homepage total) but no longer rendered individually — a freshly
  // published article's low count reads as "nobody reads this" rather than
  // "just published"; the homepage's "NEW" badge (see build.js) replaces
  // that signal without the discouraging number. Only the site-wide total
  // (a much larger, more representative figure) is still displayed.
  async function run() {
    const page = document.body.getAttribute("data-page");

    if (page === "article") {
      const slug = document.body.getAttribute("data-slug");
      if (slug) await incrementCount(slug);
      return;
    }

    const totalEl = document.getElementById("site-total-views");
    if (!totalEl) return;

    const rows = await fetchAllCounts();
    let total = 0;
    rows.forEach((r) => (total += r.views || 0));
    totalEl.textContent = total.toLocaleString(numberLocale);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
