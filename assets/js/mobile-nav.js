/**
 * Mobile nav toggle. Only affects layout at the existing 640px breakpoint
 * (see style.css) — desktop nav is untouched.
 */
(function () {
  "use strict";

  function init() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    // If the viewport grows past mobile width (rotation, devtools resize),
    // drop any stuck open/closed state so the desktop nav renders cleanly.
    window.addEventListener(
      "resize",
      function () {
        if (window.innerWidth > 640) setOpen(false);
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
