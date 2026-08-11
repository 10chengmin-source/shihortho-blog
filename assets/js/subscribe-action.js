/**
 * Powers the /subscribe/confirmed/ and /subscribe/unsubscribed/ landing
 * pages: reads ?token= from the URL, calls the matching Edge Function
 * client-side, and swaps in the success/error message already present in
 * the page (data attributes on the same element the message replaces).
 */
(function () {
  "use strict";

  function run() {
    var el = document.querySelector("[data-subscribe-action]");
    if (!el) return;

    var config = window.SUPABASE_CONFIG;
    var action = el.getAttribute("data-subscribe-action");
    var params = new URLSearchParams(window.location.search);
    var token = params.get("token");

    if (!token || !config || !config.url) {
      el.textContent = el.getAttribute("data-msg-invalid");
      return;
    }

    fetch(config.url + "/functions/v1/" + action, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: "Bearer " + config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: token }),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return null;
        });
      })
      .then(function (data) {
        el.textContent = data && data.ok ? el.getAttribute("data-msg-success") : el.getAttribute("data-msg-invalid");
      })
      .catch(function () {
        el.textContent = el.getAttribute("data-msg-error");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
