/**
 * Adaptive reading experience.
 *
 * Two independent axes are applied to <html>:
 *   data-color-mode="dark|light"     — palette only, no layout change.
 *   data-reading-level="0|1|2|3"     — progressive typography/spacing intensity.
 *
 * The very first paint is handled by a tiny inline bootstrap script placed in
 * <head> of every page (see the HTML source) which reads localStorage
 * synchronously and sets both attributes before CSS resolves, so there is no
 * flash of unstyled/mismatched content. This file (loaded with `defer`)
 * layers on the parts that can only run after the DOM exists: live signal
 * monitoring, the settings widget, and persisting state for future page loads.
 *
 * Explicit user choice always wins. Everything else is a soft signal that
 * only nudges `data-reading-level` (typography), never page content.
 */
(function () {
  "use strict";

  if (window.ADAPTIVE_READING_DISABLED) return;

  var STORAGE_KEY = "shihortho:reading-mode"; // 'auto' | 'readability' | 'dark'
  var ZOOM_FLAG_KEY = "shihortho:zoom-flag"; // 'none' | 'mild' | 'high'
  var DEBUG_KEY = "shihortho:adaptive-debug";

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* private browsing / storage disabled — degrade silently */
    }
  }

  function mq(query) {
    if (!window.matchMedia) return null;
    try {
      return window.matchMedia(query);
    } catch (e) {
      return null;
    }
  }

  // ---- Signal detection --------------------------------------------------

  function detectEnvironment() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var device = w >= 1024 ? "desktop" : w >= 640 ? "tablet" : "mobile";
    return { viewportWidth: w, device: device };
  }

  function detectColorPreference() {
    var dark = mq("(prefers-color-scheme: dark)");
    var light = mq("(prefers-color-scheme: light)");
    if (dark && dark.matches) return "dark";
    if (light && light.matches) return "light";
    return "dark"; // site default when the browser can't tell us
  }

  function detectReducedMotion() {
    var m = mq("(prefers-reduced-motion: reduce)");
    return !!(m && m.matches);
  }

  // Measures the browser/OS's actual rendered size for `1rem` via a hidden
  // offscreen probe. A user who has bumped their default/minimum font size
  // in browser or OS settings will render this larger than the 16px baseline.
  // This tells us "this person prefers larger text" — nothing about who they are.
  function detectFontPreference() {
    try {
      var probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.textContent = "M";
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;" +
        "left:-9999px;top:-9999px;font-size:1rem;line-height:1;";
      document.documentElement.appendChild(probe);
      var px = parseFloat(window.getComputedStyle(probe).fontSize) || 16;
      probe.parentNode.removeChild(probe);
      return { px: px, large: px >= 19, slightlyLarge: px >= 17.5 };
    } catch (e) {
      return { px: 16, large: false, slightlyLarge: false };
    }
  }

  // Pinch-zoom is a strong "I need this bigger" signal, but acting on it
  // mid-read (changing layout while the user's fingers are still on the
  // screen) is exactly the kind of jarring surprise this system must avoid.
  // So we only ever *record* it here, for the *next* page load to read.
  function monitorZoomPreference() {
    if (!window.visualViewport) return;
    var vv = window.visualViewport;
    var timer = null;

    function record() {
      var scale = vv.scale || 1;
      if (scale > 1.5) {
        safeSet(ZOOM_FLAG_KEY, "high");
      } else if (scale > 1.2) {
        // Don't downgrade an already-recorded 'high' from an earlier zoom.
        if (safeGet(ZOOM_FLAG_KEY) !== "high") safeSet(ZOOM_FLAG_KEY, "mild");
      }
    }

    function onResize() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(record, 200);
    }

    vv.addEventListener("resize", onResize, { passive: true });
  }

  // ---- Scoring -------------------------------------------------------------

  // Weights are intentionally conservative — see project notes. No single
  // signal should be able to push a reader all the way to the enhanced tier
  // on its own except a very deliberate one (sustained heavy pinch-zoom).
  function calculateReadabilityPreference(signals) {
    var score = 0;
    var zoomFlag = safeGet(ZOOM_FLAG_KEY) || "none";
    if (zoomFlag === "high") score += 2.5;
    else if (zoomFlag === "mild") score += 1.5;

    if (signals.fontPreference.large) score += 2;
    else if (signals.fontPreference.slightlyLarge) score += 1;

    if (signals.reducedMotion) score += 0.5;
    if (signals.environment.viewportWidth && signals.environment.viewportWidth <= 360) {
      score += 0.25;
    }
    return score;
  }

  function levelFromScore(score) {
    if (score >= 3) return 3;
    if (score >= 2) return 2;
    if (score >= 1) return 1;
    return 0;
  }

  // ---- Resolve + apply -------------------------------------------------

  function loadUserPreference() {
    return safeGet(STORAGE_KEY) || "auto";
  }

  function saveUserPreference(choice) {
    safeSet(STORAGE_KEY, choice);
  }

  function resolveReadingMode() {
    var choice = loadUserPreference();
    var environment = detectEnvironment();
    var colorPreference = detectColorPreference();
    var fontPreference = detectFontPreference();
    var reducedMotion = detectReducedMotion();

    var signals = {
      environment: environment,
      colorPreference: colorPreference,
      fontPreference: fontPreference,
      reducedMotion: reducedMotion,
      zoomFlag: safeGet(ZOOM_FLAG_KEY) || "none",
    };

    var colorMode, level, source;

    if (choice === "readability") {
      colorMode = "light";
      level = 3;
      source = "user";
    } else if (choice === "dark") {
      colorMode = "dark";
      level = 0;
      source = "user";
    } else {
      colorMode = colorPreference;
      var score = calculateReadabilityPreference(signals);
      level = levelFromScore(score);
      source = level > 0 || colorMode !== "dark" ? "adaptive" : "system";
      signals.score = score;
    }

    return { choice: choice, colorMode: colorMode, level: level, source: source, signals: signals };
  }

  function applyReadingMode(resolved) {
    var root = document.documentElement;
    root.setAttribute("data-color-mode", resolved.colorMode);
    root.setAttribute("data-reading-level", String(resolved.level));
    root.setAttribute("data-reading-choice", resolved.choice);
    trackAdaptiveReading(resolved);
    updateSettingsWidget(resolved.choice);
    renderDebugPanel(resolved);
  }

  // ---- Optional analytics (no-ops safely if none exists) ------------------

  function trackAdaptiveReading(resolved) {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "adaptive_reading", {
          reading_mode: resolved.level >= 2 ? "enhanced" : "normal",
          color_mode: resolved.colorMode,
          mode_source: resolved.source,
        });
      }
    } catch (e) {
      /* analytics must never break the page */
    }
  }

  // ---- Settings widget (footer) ------------------------------------------

  function updateSettingsWidget(choice) {
    var buttons = document.querySelectorAll("button[data-reading-choice]");
    for (var i = 0; i < buttons.length; i++) {
      var pressed = buttons[i].getAttribute("data-reading-choice") === choice;
      buttons[i].setAttribute("aria-pressed", pressed ? "true" : "false");
    }
  }

  function wireSettingsWidget() {
    var buttons = document.querySelectorAll("button[data-reading-choice]");
    if (!buttons.length) return;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        var choice = event.currentTarget.getAttribute("data-reading-choice");
        saveUserPreference(choice);
        applyReadingMode(resolveReadingMode());
      });
    }
  }

  // ---- Debug panel (opt-in only, never shown unless explicitly requested) --

  function debugRequested() {
    if (safeGet(DEBUG_KEY) === "1") return true;
    try {
      return /[?&]adaptiveDebug=1\b/.test(window.location.search);
    } catch (e) {
      return false;
    }
  }

  function renderDebugPanel(resolved) {
    if (!debugRequested()) return;
    var panel = document.getElementById("adaptive-reading-debug");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "adaptive-reading-debug";
      panel.style.cssText =
        "position:fixed;bottom:12px;left:12px;z-index:9999;max-width:280px;" +
        "background:#000;color:#0f0;font:11px/1.5 monospace;padding:10px 12px;" +
        "border-radius:6px;opacity:0.9;white-space:pre-wrap;pointer-events:none;";
      document.body.appendChild(panel);
    }
    var s = resolved.signals;
    panel.textContent =
      "Adaptive Reading Debug\n" +
      "Device: " + s.environment.device + " (" + s.environment.viewportWidth + "px)\n" +
      "Color preference (OS): " + s.colorPreference + "\n" +
      "Font preference: " + (s.fontPreference.large ? "larger" : s.fontPreference.slightlyLarge ? "slightly larger" : "normal") +
      " (" + s.fontPreference.px.toFixed(1) + "px)\n" +
      "Zoom flag (prior session): " + s.zoomFlag + "\n" +
      "Reduced motion: " + s.reducedMotion + "\n" +
      "Score: " + (s.score !== undefined ? s.score : "n/a") + "\n" +
      "Reading level: " + resolved.level + "\n" +
      "Color mode: " + resolved.colorMode + "\n" +
      "Choice: " + resolved.choice + "\n" +
      "Source: " + resolved.source;
  }

  // ---- Boot ---------------------------------------------------------------

  function init() {
    applyReadingMode(resolveReadingMode());
    wireSettingsWidget();
    monitorZoomPreference();

    // Live-update on OS color-scheme change while the tab is open, but only
    // when the reader hasn't pinned a manual choice — this mirrors a real,
    // deliberate OS-level action, not a mid-read surprise.
    var darkMq = mq("(prefers-color-scheme: dark)");
    if (darkMq && darkMq.addEventListener) {
      darkMq.addEventListener("change", function () {
        if (loadUserPreference() === "auto") applyReadingMode(resolveReadingMode());
      });
    }

    // Enable CSS transitions only after the first paint has settled, so nothing
    // animates on initial load — only on subsequent, user-triggered changes.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        document.documentElement.classList.add("reading-transitions-ready");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed for the opt-in debug panel and for manual testing in the console.
  window.AdaptiveReading = {
    detectEnvironment: detectEnvironment,
    detectFontPreference: detectFontPreference,
    detectColorPreference: detectColorPreference,
    detectReducedMotion: detectReducedMotion,
    calculateReadabilityPreference: calculateReadabilityPreference,
    resolveReadingMode: resolveReadingMode,
    applyReadingMode: applyReadingMode,
    loadUserPreference: loadUserPreference,
    saveUserPreference: saveUserPreference,
  };
})();
