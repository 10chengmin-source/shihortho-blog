/**
 * Language-switcher dropdown. Mirrors the nav-toggle open/close pattern in
 * mobile-nav.js: click to toggle, click outside or Escape to close.
 */
(function () {
  "use strict";

  function init() {
    var wrap = document.querySelector(".lang-switch");
    var toggle = wrap ? wrap.querySelector(".lang-switch-toggle") : null;
    if (!wrap || !toggle) return;

    function setOpen(open) {
      wrap.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function (event) {
      event.stopPropagation();
      setOpen(!wrap.classList.contains("is-open"));
    });

    document.addEventListener("click", function (event) {
      if (!wrap.contains(event.target)) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
