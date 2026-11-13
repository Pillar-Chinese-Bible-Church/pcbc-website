// Runs before the page draws. On someone's first visit, send them to the language their browser asks for:
// zh-TW / zh-HK / zh-MO / zh-Hant → 繁體, other Chinese → 简体, anything else → English.
// After that only the bare address (/) follows their saved choice; the 简 / 繁 / EN links (site.js) save it.
(function () {
  var KEY = "pcbc-lang";
  var PREFIX = { "zh-Hans": "", "zh-Hant": "/zh-hant", en: "/en" };
  if (/bot|crawl|spider|slurp/i.test(navigator.userAgent)) return;

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { return; }
  if (saved) {
    // Someone who picked 繁 or EN and types the bare address gets their language; links to a specific page stay as shared.
    if (location.pathname === "/" && PREFIX[saved]) location.replace(PREFIX[saved] + "/" + location.search + location.hash);
    return;
  }

  function detect() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < list.length; i++) {
      var l = String(list[i]).toLowerCase();
      if (l.indexOf("zh") === 0) return /hant|-tw|-hk|-mo/.test(l) ? "zh-Hant" : "zh-Hans";
      if (l.indexOf("en") === 0) return "en";
    }
    return "en";
  }

  var want = detect();
  try { localStorage.setItem(KEY, want); } catch (e) {}
  var current = document.documentElement.lang;
  if (want === current) return;

  var path = location.pathname.replace(/^\/(zh-hant|en)(?=\/|$)/, "") || "/";
  location.replace(PREFIX[want] + path + location.search + location.hash);
})();
