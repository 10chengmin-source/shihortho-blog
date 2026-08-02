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

  function renderCount(el, count) {
    const label = el.getAttribute("data-label") || "次瀏覽";
    el.textContent = "\u{1F441} " + count.toLocaleString("zh-Hant") + " " + label;
  }

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

  async function run() {
    const page = document.body.getAttribute("data-page");
    const badges = Array.from(document.querySelectorAll("[data-slug]"));

    if (page === "article") {
      const slug = document.body.getAttribute("data-slug");
      if (slug) {
        const newCount = await incrementCount(slug);
        if (typeof newCount === "number") {
          badges
            .filter((el) => el.getAttribute("data-slug") === slug)
            .forEach((el) => renderCount(el, newCount));
        }
      }
      return;
    }

    const rows = await fetchAllCounts();
    const bySlug = new Map(rows.map((r) => [r.slug, r.views]));
    let total = 0;
    rows.forEach((r) => (total += r.views || 0));

    badges.forEach((el) => {
      const slug = el.getAttribute("data-slug");
      const count = bySlug.get(slug) || 0;
      renderCount(el, count);
    });

    const totalEl = document.getElementById("site-total-views");
    if (totalEl) {
      totalEl.textContent = total.toLocaleString("zh-Hant");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
