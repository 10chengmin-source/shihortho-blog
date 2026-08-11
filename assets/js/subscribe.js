/**
 * Article-notification subscribe form. Copy strings (success/error/invalid
 * messages) are read from the form's own data attributes, rendered
 * per-locale by build.js, so this script has no locale table of its own.
 */
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function initForm(form) {
    var config = window.SUPABASE_CONFIG;
    if (!config || !config.url || config.url.indexOf("PLACEHOLDER") !== -1) return;

    var status = form.parentElement.querySelector(".subscribe-status");
    var emailInput = form.querySelector('input[name="email"]');
    var honeypot = form.querySelector('input[name="website"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var locale = form.getAttribute("data-locale") || "zh";
    var successMsg = form.getAttribute("data-success-msg") || "";
    var errorMsg = form.getAttribute("data-error-msg") || "";
    var invalidMsg = form.getAttribute("data-invalid-msg") || "";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = (emailInput.value || "").trim();
      if (!EMAIL_RE.test(email)) {
        status.textContent = invalidMsg;
        return;
      }

      submitBtn.disabled = true;
      status.textContent = "";

      fetch(config.url + "/functions/v1/subscribe", {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: "Bearer " + config.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          locale: locale,
          website: honeypot ? honeypot.value : "",
        }),
      })
        .then(function (res) {
          return res.json().catch(function () {
            return null;
          });
        })
        .then(function (data) {
          if (data && data.ok) {
            status.textContent = successMsg;
            form.reset();
          } else {
            status.textContent = errorMsg;
          }
        })
        .catch(function () {
          status.textContent = errorMsg;
        })
        .then(function () {
          submitBtn.disabled = false;
        });
    });
  }

  function run() {
    var forms = document.querySelectorAll(".subscribe-form");
    for (var i = 0; i < forms.length; i++) initForm(forms[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
