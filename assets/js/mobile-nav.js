/**
 * Mobile nav toggle, plus a content-aware fallback for the tablet/small-
 * desktop range above the 640px CSS breakpoint (see .site-header .container
 * and the @media (max-width: 640px) block in style.css).
 *
 * A single fixed breakpoint can't work for that range: how much horizontal
 * room the nav (6 links + lang switch + 2 CTAs) needs varies a lot by
 * locale — English/Vietnamese/Indonesian labels are meaningfully wider than
 * the Chinese ones for the same links. Instead of guessing a per-locale
 * pixel value, this measures whether the nav's actual content fits on one
 * line and toggles the same collapsed layout (via .nav-collapsed on
 * .site-header) that the 640px query already uses — so the nav never shows
 * the "half wrapped, CTA buttons floating alone" state, at any width, in
 * any locale.
 */
(function () {
  "use strict";

  function init() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!header || !toggle || !nav) return;

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

    // Below the CSS breakpoint the media query already collapses the nav
    // unconditionally — no measurement needed, and measuring would be
    // meaningless anyway (nav is already display:none in that layout).
    var MOBILE_BREAKPOINT = 640;

    // .site-nav has its own flex-wrap: wrap, so when its content doesn't
    // fit, the children wrap onto extra rows inside it rather than the nav
    // element itself reporting an overflow width — checking scrollWidth
    // vs clientWidth doesn't see that. Comparing each child's vertical
    // center does: same-row items share a center (site-nav has
    // align-items: center, so same-row items of different heights — the
    // plain links vs. the 44px-tall buttons — still share a center even
    // though their raw offsetTop differs); a differing center means it
    // already wrapped to another row.
    function fitsOnOneLine() {
      var kids = nav.children;
      if (!kids.length) return true;
      var firstCenter = kids[0].offsetTop + kids[0].offsetHeight / 2;
      for (var i = 1; i < kids.length; i++) {
        var center = kids[i].offsetTop + kids[i].offsetHeight / 2;
        if (Math.abs(center - firstCenter) > 4) return false;
      }
      return true;
    }

    function updateCollapse() {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        // Pure CSS handles this range; avoid fighting it with the class.
        header.classList.remove("nav-collapsed");
        return;
      }
      // Measure with the collapsed layout off, so the nav is laid out as a
      // normal inline row (wrapping allowed) and its true natural width is
      // visible to fitsOnOneLine()'s temporary nowrap probe.
      header.classList.remove("nav-collapsed");
      if (!fitsOnOneLine()) {
        header.classList.add("nav-collapsed");
      } else {
        setOpen(false);
      }
    }

    updateCollapse();

    var resizeTimer = null;
    window.addEventListener(
      "resize",
      function () {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(updateCollapse, 120);
      },
      { passive: true }
    );

    // Web fonts finishing load can change label widths enough to flip the
    // fit decision; re-check once they're ready (no-op if unsupported).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateCollapse).catch(function () {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
