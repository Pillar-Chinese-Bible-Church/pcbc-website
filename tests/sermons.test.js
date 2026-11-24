import test from "node:test";
import assert from "node:assert/strict";
import { assertSermon, assertSermonCollection, sermonData, sundayWindow, dateString, dateNumber, previewAllowed, pruneSermons, formatSermonDate } from "../lib/sermons.js";
import { sermonPreviewScenarios, sermonPreviewPages } from "../lib/sermon-previews.js";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import nunjucks from "nunjucks";
import sermonUi from "../src/_data/sermonUi.js";
import vm from "node:vm";

const now = Date.parse("2026-11-23T12:00:00Z");
const entry = { date: "2026-11-22", published: true, title: { zh: "感谢", en: "Thanks" }, passage: { zh: "诗篇100", en: "Psalm 100" }, speaker: { zh: "讲员", en: "Speaker" }, recording: "pending" };
const bulletin = { program: [{ label: { zh: "祷告", en: "Prayer" } }], announcements: [] };
const collection = (items, current_bulletin = "") => ({ version: 1, current_bulletin, items });
test("first launch has no content, navigation or bulletin target", () => {
  const data = sermonData(collection([]), now);
  assert.equal(data.hasContent, false);
  assert.equal(data.current, null);
  assert.deepEqual(data.recent, []);
});
test("bulletin publishes before video, ready video requires a safe ID", () => {
  const data = sermonData(collection([{ ...entry, bulletin }], entry.date), now);
  assert.equal(data.current.recording, "pending");
  assert.equal(data.items.length, 1);
  assert.doesNotThrow(() => assertSermon({ ...entry, recording: "ready", youtube_id: "abcdefghijk" }));
  for (const changes of [{ recording: "ready" }, { youtube_id: "abcdefghijk" }, { recording: "ready", youtube_id: "https://youtube.com/watch?v=bad" }, { date: "2026-11-23" }, { date: "2026-02-30" }, { published: "true" }, { title: { zh: "标题" } }, { bulletin: { program: [], announcements: [] } }]) {
    assert.throws(() => assertSermon({ ...entry, ...changes }));
  }
});
test("the rolling 52 calendar weeks exclude stale entries even with gaps", () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ ...entry, date: dateString(dateNumber(entry.date) - i * 7 * 86400000) }));
  const data = sermonData(collection(items), now);
  assert.equal(data.items.length, 52);
  assert.equal(data.items.at(-1).date, data.cutoff);
  assert.equal(sermonData(collection([items[59]]), now).hasContent, false);
  assert.deepEqual(data.items.map(i => i.date), [...data.items.map(i => i.date)].sort().reverse());
});
test("Pacific week boundary works across UTC midnight and DST", () => {
  assert.equal(sundayWindow(Date.parse("2026-11-22T07:59:59Z")).sunday, "2026-11-15");
  assert.equal(sundayWindow(Date.parse("2026-11-22T08:00:00Z")).sunday, "2026-11-22");
  assert.equal(sundayWindow(Date.parse("2026-03-08T07:59:59Z")).sunday, "2026-03-01");
  assert.equal(sundayWindow(Date.parse("2026-03-08T08:00:00Z")).sunday, "2026-03-08");
  assert.equal(formatSermonDate("2026-11-22", "en"), "November 22, 2026");
});
test("current bulletin is explicit, can be prepared early and cannot silently stay on last week", () => {
  const previous = { ...entry, date: "2026-11-15", bulletin };
  const next = { ...entry, date: "2026-11-29", bulletin };
  assert.equal(sermonData(collection([previous], previous.date), now).current, null);
  assert.equal(sermonData(collection([next], next.date), now).current.date, next.date);
  assert.equal(sermonData(collection([next]), now).hasContent, false);
  assert.deepEqual(pruneSermons(collection([next]), now).items, [next]);
  assert.equal(sermonData(collection([{ ...entry, bulletin }]), now).current, null);
  assert.throws(() => assertSermonCollection(collection([entry], entry.date)));
  assert.throws(() => assertSermonCollection(collection([entry, entry])));
});
test("drafts, distant future and sample entries never enter the real collection output", () => {
  for (const change of [{ sample: true }, { published: false }, { date: "2026-12-06" }]) assert.equal(sermonData(collection([{ ...entry, ...change }]), now).items.length, 0);
  for (const branch of ["main", "live"]) assert.equal(previewAllowed({ CF_PAGES_BRANCH: branch, SERMONS_PREVIEW: "1" }), false);
  assert.equal(previewAllowed({}), false);
  assert.equal(previewAllowed({ SERMONS_PREVIEW: "1" }), true);
  assert.equal(previewAllowed({ CF_PAGES_BRANCH: "codex/sermons" }), true);
  assert.equal(sermonPreviewScenarios(now).length, 4);
  assert.ok(sermonPreviewPages(now).every(page => page.pagePath.startsWith("/_preview/sermons/") && page.data.preview));
});
test("pruning removes expired source records, clears deleted selection and preserves drafts", () => {
  const old = { ...entry, date: "2025-01-05", bulletin };
  const draft = { ...entry, date: "2025-01-12", published: false };
  const result = pruneSermons(collection([entry, old, draft], old.date), now);
  assert.deepEqual(result.items.map(i => i.date), [entry.date, draft.date]);
  assert.equal(result.current_bulletin, "");
  assert.deepEqual(pruneSermons(result, now), result);
});
test("preview UI covers empty, bulletin-first, recorded and past-only without a real player", () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("src/_includes"));
  env.addFilter("t", x => typeof x === "string" ? x : x?.en || "");
  env.addFilter("tt", x => (x?.en || "").replaceAll("<", "&lt;"));
  env.addFilter("sermonDate", formatSermonDate);
  const s = sermonUi.en;
  for (const scene of sermonPreviewScenarios(now)) {
    const context = { L: { code: "en", prefix: "/en" }, sermonUi, sd: scene.data, sermonBase: "/preview", sermonHome: "/", site: { sunday: { time: { en: "Sunday" } }, name: { en: "Church" }, links: {} }, ui: { en: { nav: { sunday: "Sunday" } } } };
    const archive = parseHTML(env.render("sermons/archive.njk", context)).document;
    assert.equal(archive.querySelectorAll("h1").length, 1);
    if (scene.id === "empty") assert.match(archive.querySelector("main").textContent, /coming soon/);
    else assert.ok(archive.querySelectorAll(".sermon-row").length >= 2);
    const rendered = env.render("sermons/bulletin.njk", { ...context, e: scene.data.current });
    assert.ok(rendered.includes(scene.data.current ? s.program : s.notReady));
    if (scene.data.current) {
      const detail = env.render("sermons/detail.njk", { ...context, e: scene.data.current });
      assert.ok(detail.includes(scene.id === "recorded" ? s.sampleVideo : s.pending));
      assert.doesNotMatch(detail, /youtube-nocookie|data-video-load/);
    }
  }
});
test("real recording creates exactly one privacy-enhanced player after Play; no script leaves a YouTube link", () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("src/_includes"));
  env.addFilter("t", value => value?.en || "");
  env.addFilter("sermonDate", formatSermonDate);
  const e = { ...entry, recording: "ready", youtube_id: "abcdefghijk" };
  const html = env.render("sermons/detail.njk", { L: { code: "en" }, e, sermonUi, sermonBase: "", site: {} });
  const { document, window } = parseHTML(html);
  assert.equal(document.querySelectorAll("iframe").length, 0);
  assert.equal(document.querySelector("a[href^='https://www.youtube.com/watch']").href, "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(document.querySelector("[data-video-load]").hidden, true);
  vm.runInNewContext(readFileSync("src/assets/sermons.js", "utf8"), { document });
  const button = document.querySelector("[data-video-load]");
  assert.equal(button.hidden, false);
  const nativeCreate = document.createElement.bind(document);
  document.createElement = name => { const el = nativeCreate(name); el.focus = () => {}; return el; };
  button.click();
  assert.equal(document.querySelectorAll("iframe").length, 1);
  assert.equal(document.querySelector("iframe").src, "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1");
  assert.equal(document.querySelector("iframe").title, "Thanks");
  button.click();
  assert.equal(document.querySelectorAll("iframe").length, 1);
});
