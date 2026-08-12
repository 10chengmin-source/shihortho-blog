/**
 * Powers the private (unlisted) mobile page for capturing article ideas.
 * Posts to the submit-idea Edge Function. Voice input relies entirely on
 * the phone keyboard's own built-in dictation button (works reliably on
 * both iOS and Android) rather than the Web Speech API — iOS Safari
 * exposes webkitSpeechRecognition but it doesn't actually work, so a
 * custom mic button there would just fail silently/confusingly.
 */
(function () {
  "use strict";

  function init() {
    var config = window.SUPABASE_CONFIG;
    var textarea = document.getElementById("notes-input");
    var submitBtn = document.getElementById("notes-submit");
    var status = document.getElementById("notes-status");
    if (!textarea || !submitBtn || !status) return;

    if (!config || !config.url || config.url.indexOf("PLACEHOLDER") !== -1) {
      status.textContent = "設定錯誤，請聯絡管理員。";
      return;
    }

    submitBtn.addEventListener("click", function () {
      var content = (textarea.value || "").trim();
      if (!content) {
        status.textContent = "請先輸入一些內容。";
        return;
      }

      submitBtn.disabled = true;
      status.textContent = "送出中…";

      fetch(config.url + "/functions/v1/submit-idea", {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: "Bearer " + config.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: content }),
      })
        .then(function (res) {
          return res.json().catch(function () {
            return null;
          });
        })
        .then(function (data) {
          if (data && data.ok) {
            status.textContent = "已送出，謝謝！";
            textarea.value = "";
          } else {
            status.textContent = "送出失敗，請稍後再試。";
          }
        })
        .catch(function () {
          status.textContent = "送出失敗，請稍後再試。";
        })
        .then(function () {
          submitBtn.disabled = false;
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
