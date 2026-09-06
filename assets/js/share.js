(function () {
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
  }

  document.querySelectorAll(".share-block").forEach(function (block) {
    var status = block.querySelector(".share-status");
    var copyBtn = block.querySelector(".share-btn-copy");
    var nativeBtn = block.querySelector(".share-btn-native");

    function showStatus(text) {
      if (!status) return;
      status.textContent = text;
      window.setTimeout(function () {
        status.textContent = "";
      }, 2500);
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var url = copyBtn.getAttribute("data-copy-url") || window.location.href;
        var copiedText = copyBtn.getAttribute("data-copied-text") || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(url)
            .catch(function () {
              fallbackCopy(url);
            })
            .then(function () {
              showStatus(copiedText);
            });
        } else {
          fallbackCopy(url);
          showStatus(copiedText);
        }
      });
    }

    if (nativeBtn && navigator.share) {
      nativeBtn.hidden = false;
      nativeBtn.addEventListener("click", function () {
        navigator
          .share({
            title: nativeBtn.getAttribute("data-share-title") || document.title,
            url: nativeBtn.getAttribute("data-share-url") || window.location.href,
          })
          .catch(function () {});
      });
    }
  });
})();
