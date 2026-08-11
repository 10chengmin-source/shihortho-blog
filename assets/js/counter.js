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

  // View counts are tracked silently (Supabase page_views table, visible in
  // the Supabase dashboard) but never rendered on the site — a freshly
  // published article's low count reads as "nobody reads this" rather than
  // "just published"; the homepage's "NEW" badge (see build.js) signals that
  // instead, without a discouraging number anywhere on the public site.
  function incrementCount(slug) {
    fetch(config.url + "/rest/v1/rpc/increment_page_view", {
      method: "POST",
      headers,
      body: JSON.stringify({ slug_input: slug }),
    }).catch(function () {});
  }

  function run() {
    if (document.body.getAttribute("data-page") !== "article") return;
    const slug = document.body.getAttribute("data-slug");
    if (slug) incrementCount(slug);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
