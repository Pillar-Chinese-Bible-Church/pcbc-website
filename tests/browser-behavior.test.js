import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import nunjucks from "nunjucks";
import { parseHTML } from "linkedom";
import { locales } from "../lib/locales.js";
import { assertLocalizedContent, assertInterfaceTranslations } from "../lib/content.js";

const languageTemplate = fs.readFileSync("src/lang.njk", "utf8").replace(/^---[\s\S]*?---\s*/, "");
const env = new nunjucks.Environment();
env.addFilter("json", JSON.stringify);
const languageScript = env.renderString(languageTemplate, { langs: locales });
function redirect({ pathname = "/", languages = ["en-US"], saved, blocked = false, search = "", hash = "", userAgent = "Browser" } = {}) {
  let result;
  vm.runInNewContext(languageScript, {
    navigator: { languages, userAgent },
    localStorage: { getItem: () => { if (blocked) throw new Error("blocked"); return saved; } },
    location: { pathname, search, hash, replace: value => { result = value; } },
  });
  return result;
}
test("explicit language and deep links survive first visits, saved preferences and blocked storage", () => {
  for (const pathname of ["/en/giving/", "/zh-hant/contact/", "/giving/", "/events/shared-event/"]) {
    for (const blocked of [true, false]) assert.equal(redirect({ pathname, languages: ["zh-TW"], saved: "en", blocked }), undefined);
  }
  assert.equal(redirect({ languages: ["zh-TW"], search: "?topic=visit", hash: "#sunday" }), "/zh-hant/?topic=visit#sunday");
  assert.equal(redirect({ languages: ["zh-CN"] }), undefined);
  assert.equal(redirect({ languages: ["zh-TW"], saved: "en" }), "/en/");
  assert.equal(redirect({ languages: ["zh-TW"], saved: "zh-Hans" }), undefined);
  assert.equal(redirect({ languages: ["en"], blocked: true }), "/en/");
  assert.equal(redirect({ languages: ["en"], userAgent: "Googlebot" }), undefined);
});

test("translation checks reject missing English and interface key drift", () => {
  assert.throws(() => assertLocalizedContent({ title: { zh: "标题" } }));
  assert.throws(() => assertLocalizedContent({ title: { en: "Title" } }));
  assert.throws(() => assertInterfaceTranslations({ "zh-Hans": { title: "标题" }, "zh-Hant": { title: "標題" }, en: {} }));
});

function setupPage(html, now, hash = "") {
  const listeners = {};
  const location = { hash };
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  let timer;
  let clock = now;
  const track = document.getElementById("event-track");
  if (track) {
    Object.defineProperties(track, {
      clientWidth: { value: 900 },
      scrollWidth: { get: () => document.querySelectorAll(".event-card:not([hidden])").length * 300 },
      scrollLeft: { value: 0, writable: true },
    });
    track.scrollBy = options => { track.scrollLeft += options.left; track.dispatchEvent(new document.defaultView.Event("scroll")); };
  }
  class Clock extends Date { static now() { return clock; } }
  vm.runInNewContext(fs.readFileSync("src/assets/site.js", "utf8"), {
    document, Date: Clock,
    window: { location, setInterval: callback => { timer = callback; }, addEventListener: (type, callback) => { listeners[type] = callback; }, matchMedia: () => ({ matches: true }) },
    localStorage: { setItem() {} },
  });
  return { document, advance: value => { clock = value; timer(); }, hasTimer: () => !!timer, setHash: value => { location.hash = value; listeners.hashchange(); } };
}
test("carousel exposes more than three events and stays populated after the first three expire", () => {
  const earlyEnd = "2026-12-06T20:00:00Z";
  const laterEnd = "2026-12-10T20:00:00Z";
  const cards = Array.from({ length: 5 }, (_, index) => `<article class="event-card" data-event-end="${index < 3 ? earlyEnd : laterEnd}"><a href="#">Event ${index}</a></article>`).join("");
  const { document, advance } = setupPage(`<a data-events-nav data-last-event-end="${laterEnd}">Events</a><section data-upcoming-events><div data-event-controls hidden><button data-event-prev></button><button data-event-next></button></div><div id="event-track">${cards}</div></section>`, Date.parse(earlyEnd) - 1000);
  assert.equal(document.querySelector("[data-event-controls]").hidden, false);
  document.querySelector("[data-event-next]").click();
  assert.equal(document.getElementById("event-track").scrollLeft, 900);
  advance(Date.parse(earlyEnd));
  assert.equal(document.querySelectorAll(".event-card:not([hidden])").length, 2);
  assert.equal(document.querySelector("[data-upcoming-events]").hidden, false);
  assert.equal(document.querySelector("[data-events-nav]").hidden, false);
  assert.equal(document.querySelector("[data-event-controls]").hidden, true);
  advance(Date.parse(laterEnd));
  assert.equal(document.querySelector("[data-upcoming-events]").hidden, true);
  assert.equal(document.querySelector("[data-events-nav]").hidden, true);
});
test("detail pages hide expired registration and navigation and show the ended notice", () => {
  const end = "2026-12-06T20:00:00Z";
  const { document } = setupPage(`<a data-events-nav data-last-event-end="${end}">Events</a><a data-event-end="${end}">Register</a><p data-ended-notice="${end}" hidden>Ended</p>`, Date.parse(end));
  assert.equal(document.querySelector("[data-events-nav]").hidden, true);
  assert.equal(document.querySelector("[data-event-end]").hidden, true);
  assert.equal(document.querySelector("[data-ended-notice]").hidden, false);
  assert.equal(setupPage("<main>No events</main>", Date.now()).hasTimer(), false);
});

test("mobile menu keeps its icon, updates its accessible label and closes with Escape", () => {
  const { document } = setupPage('<button id="menuBtn" aria-expanded="false" aria-label="Menu" data-open="Close" data-closed="Menu"><span class="menu-icon" aria-hidden="true"></span></button><nav id="nav"><a href="/giving/">Giving</a></nav>', Date.now());
  const button = document.getElementById("menuBtn");
  button.focus = () => {};
  button.click();
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(button.getAttribute("aria-label"), "Close");
  assert.ok(button.querySelector(".menu-icon"));
  const event = new document.defaultView.Event("keydown");
  event.key = "Escape";
  document.dispatchEvent(event);
  assert.equal(button.getAttribute("aria-label"), "Menu");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(document.getElementById("nav").classList.contains("open"), false);
});


test("homepage section navigation highlights the selected anchor and clears stale selections", () => {
  const links = ["sunday", "events", "groups"].map(id => `<a href="/en/#${id}" data-nav-section="${id}">${id}</a>`).join("");
  const html = `<button id="menuBtn"></button><nav id="nav">${links}</nav>`;
  const sections = '<section id="sunday"></section><section id="events"></section><section id="groups"></section>';
  const page = setupPage(html + sections, Date.now(), "#sunday");
  for (const id of ["sunday", "events", "groups"]) {
    page.setHash("#" + id);
    assert.equal(page.document.querySelectorAll('#nav [aria-current="location"]').length, 1);
    assert.equal(page.document.querySelector(`[data-nav-section="${id}"]`).getAttribute("aria-current"), "location");
  }
  page.setHash("");
  assert.equal(page.document.querySelectorAll('#nav [aria-current]').length, 0);
  const detail = setupPage(html, Date.now(), "#events");
  assert.equal(detail.document.querySelectorAll('#nav [aria-current]').length, 0);
});
