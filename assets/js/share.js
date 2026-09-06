(function () {
  "use strict";

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      ta.setSelectionRange(0, text.length);
    } catch (e) {}
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  // Some in-app browsers (LINE's, Facebook's, Instagram's) implement
  // navigator.clipboard.writeText but never resolve or reject the promise,
  // which made the button look completely dead. Racing it against a short
  // timeout guarantees we always fall back to execCommand("copy").
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("timeout"));
      }, ms);
      promise.then(
        function (value) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  document.querySelectorAll(".share-btn-copy").forEach(function (btn) {
    var label = btn.querySelector(".share-btn-label");
    var idleText = btn.getAttribute("data-label") || "";
    var copiedText = btn.getAttribute("data-copied-label") || "";
    var resetTimer = null;

    function showCopied() {
      btn.classList.add("is-copied");
      if (label) label.textContent = copiedText;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        btn.classList.remove("is-copied");
        if (label) label.textContent = idleText;
      }, 2000);
    }

    btn.addEventListener("click", function () {
      var url = btn.getAttribute("data-copy-url") || window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        withTimeout(navigator.clipboard.writeText(url), 1200).then(
          function () {
            showCopied();
          },
          function () {
            fallbackCopy(url);
            showCopied();
          }
        );
      } else {
        fallbackCopy(url);
        showCopied();
      }
    });
  });

  document.querySelectorAll(".share-btn-native").forEach(function (btn) {
    if (!navigator.share) return;
    btn.hidden = false;
    btn.addEventListener("click", function () {
      navigator
        .share({
          title: btn.getAttribute("data-share-title") || document.title,
          url: btn.getAttribute("data-share-url") || window.location.href,
        })
        .catch(function () {});
    });
  });

  var wrap = document.querySelector(".site-share");
  var toggle = wrap ? wrap.querySelector(".site-share-toggle") : null;
  if (wrap && toggle) {
    var setOpen = function (open) {
      wrap.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

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
})();
