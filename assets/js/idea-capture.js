/**
 * Powers notes/index.html, a private (unlisted) mobile page for capturing
 * article ideas. Posts to the submit-idea Edge Function. The mic button is
 * a progressive enhancement via the Web Speech API — on browsers without
 * it, the textarea still works fine with the phone keyboard's own built-in
 * dictation button.
 */
(function () {
  "use strict";

  function init() {
    var config = window.SUPABASE_CONFIG;
    var textarea = document.getElementById("notes-input");
    var submitBtn = document.getElementById("notes-submit");
    var micBtn = document.getElementById("notes-mic");
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

    var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor || !micBtn) return;

    var recognition = new SpeechRecognitionCtor();
    recognition.lang = "zh-TW";
    recognition.interimResults = false;
    recognition.continuous = true;
    var listening = false;

    micBtn.hidden = false;

    recognition.addEventListener("result", function (event) {
      var chunk = "";
      for (var i = event.resultIndex; i < event.results.length; i++) {
        chunk += event.results[i][0].transcript;
      }
      if (!chunk) return;
      var existing = textarea.value;
      textarea.value = existing && !/\s$/.test(existing) ? existing + " " + chunk : existing + chunk;
    });

    recognition.addEventListener("end", function () {
      listening = false;
      micBtn.textContent = "🎤 語音輸入";
      micBtn.setAttribute("aria-pressed", "false");
    });

    recognition.addEventListener("error", function () {
      listening = false;
      micBtn.textContent = "🎤 語音輸入";
      micBtn.setAttribute("aria-pressed", "false");
      status.textContent = "語音辨識發生問題，請直接用鍵盤輸入。";
    });

    micBtn.addEventListener("click", function () {
      if (listening) {
        recognition.stop();
        return;
      }
      listening = true;
      micBtn.textContent = "🎤 聆聽中…（點擊停止）";
      micBtn.setAttribute("aria-pressed", "true");
      status.textContent = "";
      try {
        recognition.start();
      } catch (e) {
        listening = false;
        micBtn.textContent = "🎤 語音輸入";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
