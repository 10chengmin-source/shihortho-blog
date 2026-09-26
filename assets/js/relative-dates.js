/**
 * Refreshes English "Latest / Within the last 2 weeks / N months ago"
 * labels on page load. scripts/build.js already bakes the correct label in
 * at build time (so this is never required for a first correct render, and
 * a no-JS visitor still sees accurate text) — this only keeps it accurate
 * between builds, e.g. an article that was "Latest" a month ago should read
 * "1 month ago" today even if nothing has been rebuilt since. English only:
 * other locales don't use data-published/data-latest and this script isn't
 * loaded on their pages.
 *
 * Mirrors scripts/build.js's formatEnRelativeLabel() thresholds exactly —
 * keep the two in sync if either changes.
 */
(function () {
  "use strict";

  function label(publishedDate, latestDate) {
    if (publishedDate === latestDate) return "Latest";
    var then = new Date(publishedDate + "T12:00:00");
    if (Number.isNaN(then.getTime())) return "";
    var now = new Date();
    var days = Math.max(
      0,
      Math.floor(
        (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
          Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) /
          86400000
      )
    );
    if (days <= 14) return "Within the last 2 weeks";
    if (days < 30) return "Within the last month";
    if (days < 60) return "1 month ago";
    if (days < 365) return Math.floor(days / 30) + " months ago";
    var years = Math.floor(days / 365);
    return years === 1 ? "1 year ago" : years + " years ago";
  }

  document.querySelectorAll("time[data-published]").forEach(function (el) {
    var value = label(el.dataset.published, el.dataset.latest);
    if (value) el.textContent = value;
  });
})();
