import test from "node:test";
import assert from "node:assert/strict";
import { assertSermon, assertSermonCollection, sermonData, sundayWindow, dateString, dateNumber, previewAllowed, pruneSermons, formatSermonDate, paginatePastSermons, SERMONS_PER_PAGE, sermonArchiveReturn } from "../lib/sermons.js";
import { sermonPreviewScenarios, sermonPreviewPages } from "../lib/sermon-previews.js";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import nunjucks from "nunjucks";
import sermonUi from "../src/_data/sermonUi.js";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { execFileSync } from "node:child_process";

const now = Date.parse("2026-11-22T20:00:00Z");
const entry = { date: "2026-11-22", published: true, title: { zh: "感谢", en: "Thanks" }, speaker: { zh: "讲员", en: "Speaker" }, recording: "pending" };
const bulletin = { program: [{ label: { zh: "祷告", en: "Prayer" } }], announcements: [] };
const collection = items => ({ version: 1, items });
test("static archive pagination covers empty, exact and partial pages without omissions", () => {
  for (const count of [0, 1, 6, 7, 12, 13, 51, 52]) {
    const items = Array.from({ length: count }, (_, index) => ({ date: String(index) }));
    const pages = paginatePastSermons(items);
    assert.equal(pages.length, Math.max(1, Math.ceil(count / SERMONS_PER_PAGE)));
    assert.deepEqual(pages.flatMap(page => page.items), items);
    assert.equal(pages[0].path, "/sermons/");
    assert.equal(pages[0].previous, null);
    assert.equal(pages.at(-1).next, null);
    for (const [index, page] of pages.entries()) {
      assert.ok(page.items.length <= 6);
      assert.equal(page.number, index + 1);
      assert.equal(page.previous?.path, pages[index - 1]?.path);
      assert.equal(page.next?.path, pages[index + 1]?.path);
      if (index) assert.equal(page.path, `/sermons/page/${index + 1}/`);
    }
  }
});
test("first launch has no content, navigation or bulletin target", () => {
  const data = sermonData(collection([]), now);
  assert.equal(data.hasContent, false);
  assert.equal(data.current, null);
  assert.deepEqual(data.recent, []);
});
test("bulletin publishes before video, ready video requires a safe ID", () => {
  assert.doesNotThrow(() => assertSermon(entry));
  assert.throws(() => assertSermon({ ...entry, passage: { zh: "经文", en: "Verse" } }));
  const data = sermonData(collection([{ ...entry, bulletin }]), now);
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
test("current Sunday is automatic and future bulletins are prebuilt for request-time rollover", () => {
  const previous = { ...entry, date: "2026-11-15", bulletin };
  const next = { ...entry, date: "2026-11-29", bulletin };
  assert.equal(sermonData(collection([previous]), now).current, null);
  const sunday = sermonData(collection([entry, next]), now);
  assert.equal(sunday.current.date, entry.date);
  assert.deepEqual(sunday.items.map(item => item.date), [entry.date]);
  assert.deepEqual(sunday.datedItems.map(item => item.date), [next.date, entry.date]);
  const monday = sermonData(collection([entry, next]), Date.parse("2026-11-23T08:00:00Z"));
  assert.equal(monday.current.date, next.date);
  assert.deepEqual(monday.recent.map(item => item.date), [entry.date]);
  assert.equal(sermonData(collection([entry]), Date.parse("2026-11-23T08:00:00Z")).current, null);
  assert.deepEqual(pruneSermons(collection([next]), now).items, [next]);
  assert.throws(() => assertSermonCollection({ ...collection([entry]), current_bulletin: entry.date }));
  assert.throws(() => assertSermonCollection(collection([entry, entry])));
});
test("drafts, distant future and sample entries never enter the real collection output", () => {
  for (const change of [{ sample: true }, { published: false }, { date: "2026-12-06" }]) assert.equal(sermonData(collection([{ ...entry, ...change }]), now).items.length, 0);
  for (const branch of ["main", "live"]) assert.equal(previewAllowed({ CF_PAGES_BRANCH: branch, SERMONS_PREVIEW: "1" }), false);
  assert.equal(previewAllowed({}), false);
  assert.equal(previewAllowed({ SERMONS_PREVIEW: "1" }), true);
  assert.equal(previewAllowed({ CF_PAGES_BRANCH: "codex/sermons" }), true);
  assert.equal(sermonPreviewScenarios(now).length, 5);
  assert.ok(sermonPreviewPages(now).every(page => page.pagePath.startsWith("/_preview/sermons/") && page.data.preview));
});
test("pruning removes expired source records and preserves drafts", () => {
  const old = { ...entry, date: "2025-01-05", bulletin };
  const draft = { ...entry, date: "2025-01-12", published: false };
  const result = pruneSermons(collection([entry, old, draft]), now);
  assert.deepEqual(result.items.map(i => i.date), [entry.date, draft.date]);
  assert.deepEqual(Object.keys(result), ["version", "items"]);
  assert.deepEqual(pruneSermons(result, now), result);
});
test("preview UI covers empty, bulletin-first, recorded and past-only without a real player", () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("src/_includes"));
  env.addFilter("t", x => typeof x === "string" ? x : x?.en || "");
  env.addFilter("tt", x => (x?.en || "").replaceAll("<", "&lt;"));
  env.addFilter("sermonDate", formatSermonDate);
  env.addFilter("sermonArchiveReturn", sermonArchiveReturn);
  const s = sermonUi.en;
  for (const scene of sermonPreviewScenarios(now)) {
    const context = { L: { code: "en", prefix: "/en" }, archivePage: paginatePastSermons(scene.data.recent)[0], sermonUi, sd: scene.data, sermonBase: "/preview", sermonHome: "/", site: { sunday: { time: { en: "Sunday" } }, name: { en: "Church" }, links: {} }, ui: { en: { nav: { sunday: "Sunday" } } } };
    const archive = parseHTML(env.render("sermons/archive.njk", context)).document;
    assert.equal(archive.querySelectorAll("h1").length, 1);
    if (scene.id === "empty") assert.match(archive.querySelector("main").textContent, /coming soon/);
    else if (scene.id === "current-only") assert.ok(archive.querySelector(".sermon-history-empty"));
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
test("a first Sunday keeps current content and shows an empty history before and after recording publication", () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("src/_includes"));
  env.addFilter("t", value => typeof value === "string" ? value : value?.en || "");
  env.addFilter("sermonDate", formatSermonDate);
  const scenario = sermonPreviewScenarios(now).find(scene => scene.id === "current-only");
  for (const recording of ["pending", "ready", "unavailable"]) {
    const current = { ...scenario.data.current, recording };
    const sd = { ...scenario.data, current, items: [current] };
    const document = parseHTML(env.render("sermons/archive.njk", {
      L: { code: "en" }, sd, archivePage: paginatePastSermons([])[0], sermonUi, sermonBase: "/preview", site: { links: { youtube: "https://www.youtube.com/@example" } }
    })).document;
    assert.ok(document.querySelector(".sermon-current"));
    assert.equal(document.querySelector(".sermon-history-empty h2").textContent, "No past sermons yet");
    assert.equal(document.querySelectorAll(".sermon-row").length, 0);
    assert.equal(document.querySelector(".sermon-pagination"), null);
    assert.equal(document.querySelector(".sermon-channel"), null);
    assert.ok(document.querySelector('.sermon-current a[href="/preview/bulletin/"]'));
    assert.equal(!!document.querySelector(".sermon-current .sermon-status"), recording !== "ready");
  }
  for (const prefix of ["", "/en", "/zh-hant"]) {
    const pages = sermonPreviewPages(now).filter(page => page.id === "current-only" && page.language.prefix === prefix);
    assert.equal(pages.filter(page => page.view === "archive").length, 1);
    assert.ok(pages.some(page => page.view === "bulletin" && page.path === "/bulletin/" && page.entry));
  }
});
test("past-sermon pages preserve current Sunday and render working first/middle/last controls", () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("src/_includes"));
  env.addFilter("t", value => typeof value === "string" ? value : value?.en || "");
  env.addFilter("sermonDate", formatSermonDate);
  env.addFilter("sermonArchiveReturn", sermonArchiveReturn);
  const scenario = sermonPreviewScenarios(now).find(scene => scene.id === "recorded");
  const pages = paginatePastSermons(scenario.data.recent);
  assert.equal(pages.length, 3);
  for (const archivePage of pages) {
    const document = parseHTML(env.render("sermons/archive.njk", {
      L: { code: "en" }, sd: scenario.data, archivePage, sermonUi, sermonBase: "/en/_preview/sermons/recorded", site: { links: {} }
    })).document;
    assert.equal(document.querySelectorAll(".sermon-row").length, archivePage.items.length);
    assert.ok(document.querySelector(".sermon-current"));
    assert.equal(document.querySelector(".sermon-pagination [aria-current]").textContent, String(archivePage.number));
    assert.equal(!!document.querySelector('[rel="prev"]'), archivePage.number > 1);
    assert.equal(!!document.querySelector('[rel="next"]'), archivePage.number < pages.length);
    assert.ok(document.querySelector(".sermon-pagination").textContent.includes(`Page ${archivePage.number} of 3`));
    for (const link of document.querySelectorAll(".sermon-pagination a")) {
      assert.ok(link.getAttribute("href").startsWith("/en/_preview/sermons/recorded/sermons/"));
      assert.ok(link.getAttribute("href").endsWith("#past-sermons"));
    }
  }
});
test("preview archives generate a route for every page and locale", () => {
  const pages = sermonPreviewPages(now);
  for (const prefix of ["", "/en", "/zh-hant"]) {
    for (const number of [1, 2, 3]) {
      const path = number === 1 ? "/sermons/" : `/sermons/page/${number}/`;
      assert.ok(pages.some(page => page.language.prefix === prefix && page.id === "recorded" && page.path === path));
    }
    assert.equal(pages.filter(page => page.language.prefix === prefix && page.id === "empty" && page.view === "archive").length, 1);
  }
});
test("detail return links preserve the containing archive page, including the current Sunday", () => {
  const data = sermonPreviewScenarios(now).find(scene => scene.id === "recorded").data;
  assert.equal(sermonArchiveReturn(data, data.current.date), "/sermons/#current-sunday");
  for (const page of paginatePastSermons(data.recent)) {
    for (const entry of page.items) assert.equal(sermonArchiveReturn(data, entry.date), `${page.path}#past-sermons`);
  }
  assert.equal(sermonArchiveReturn(data, "1900-01-07"), "/sermons/");
});
test("weekly static fallback never renders an older bulletin", () => {
  const previous = { ...entry, date: "2026-11-15", bulletin };
  const data = sermonData(collection([entry, previous]), now);
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("src/_includes"));
  env.addFilter("t", value => value?.en || "");
  env.addFilter("sermonDate", formatSermonDate);
  env.addFilter("sermonArchiveReturn", sermonArchiveReturn);
  const document = parseHTML(env.render("sermons/bulletin.njk", { L: { code: "en" }, e: null, weeklyBulletinPage: true, sd: data, sermonUi, sermonBase: "/en", sermonHome: "/en/", site: { sunday: { time: { en: "Sunday" } } }, ui: { en: { nav: { sunday: "Sunday" } } } })).document;
  assert.equal(document.querySelector(".bulletin-program"), null);
  assert.equal(document.querySelector(".sermon-recent-bulletin"), null);
  assert.equal(document.querySelector(".sermon-empty h2").textContent, sermonUi.en.notReady);
  assert.equal(document.querySelector("[data-bulletin-week]").getAttribute("datetime"), entry.date);
});
test("preview detail neighbors match production first, middle and last navigation", () => {
  const pages = sermonPreviewPages(now).filter(page => page.id === "recorded" && page.language.code === "en" && page.view === "sermon");
  assert.equal(pages[0].newer, undefined);
  assert.equal(pages.at(-1).older, undefined);
  for (const [index, page] of pages.entries()) {
    assert.equal(page.newer?.date, pages[index - 1]?.entry.date);
    assert.equal(page.older?.date, pages[index + 1]?.entry.date);
  }
});
test("real detail and dated-bulletin metadata escape special characters exactly once", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pcbc-sermon-metadata-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ["src", "lib", "schemas", "scripts", "content"]) fs.cpSync(directory, path.join(root, directory), { recursive: true });
  for (const file of ["package.json", ".pages.yml", "eleventy.config.js"]) fs.copyFileSync(file, path.join(root, file));
  fs.symlinkSync(fs.realpathSync("node_modules"), path.join(root, "node_modules"));
  const example = sermonPreviewScenarios().find(scene => scene.id === "bulletin").data.current;
  const title = "God's love & grace <script>notCode()</script>";
  const real = { ...example, sample: false, title: { zh: title, en: title } };
  const future = { ...real, date: dateString(dateNumber(real.date) + 7 * 86400000) };
  const draft = { ...real, date: dateString(dateNumber(real.date) - 7 * 86400000), published: false };
  const sample = { ...real, date: dateString(dateNumber(real.date) - 14 * 86400000), sample: true };
  const withoutBulletin = { ...real, date: dateString(dateNumber(real.date) - 21 * 86400000) };
  delete withoutBulletin.bulletin;
  fs.writeFileSync(path.join(root, "content/sermons.yml"), yaml.dump(collection([real, future, draft, sample, withoutBulletin]), { noRefs: true }));
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root, env: { ...process.env, CF_PAGES_BRANCH: "live", SERMONS_PREVIEW: "1" }, timeout: 60000, stdio: "pipe" });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "_site/assets/bulletins.json"), "utf8")), { version: 1, preview: false, dates: [future.date, real.date] });
  for (const prefix of ["", "en", "zh-hant"]) {
    const weekly = parseHTML(fs.readFileSync(path.join(root, "_site", prefix, "bulletin/index.html"), "utf8")).document;
    assert.equal(weekly.querySelector(".bulletin-program"), null);
    assert.ok(weekly.querySelector("[data-bulletin-week]"));
    assert.ok(fs.existsSync(path.join(root, "_site", prefix, "sermons", future.date, "bulletin/index.html")));
    for (const hidden of [draft, sample]) assert.equal(fs.existsSync(path.join(root, "_site", prefix, "sermons", hidden.date)), false);
  }
  const siteName = yaml.load(fs.readFileSync("src/_data/site.yml", "utf8")).name.en;
  for (const suffix of ["", "bulletin/"]) {
    const document = parseHTML(fs.readFileSync(path.join(root, "_site/en/sermons", real.date, suffix, "index.html"), "utf8")).document;
    assert.equal(document.title, `${title} · ${siteName}`);
    assert.equal(document.querySelector('meta[property="og:title"]').getAttribute("content"), `${title} · ${siteName}`);
    assert.equal(document.querySelector("script:not([src])"), null);
    if (!suffix) assert.equal(document.querySelector("h1").textContent, title);
  }
});
test("real recording creates exactly one privacy-enhanced player after Play; no script leaves a YouTube link", () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader("src/_includes"));
  env.addFilter("t", value => value?.en || "");
  env.addFilter("sermonDate", formatSermonDate);
  env.addFilter("sermonArchiveReturn", sermonArchiveReturn);
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

test("preview state picker supports fixed URLs and changes, but overrides are inert without preview controls", () => {
  const source = readFileSync("src/assets/sermon-preview.js", "utf8");
  function run(search, controls = true) {
    const { document, window } = parseHTML(controls ? '<nav data-sermon-preview-controls><select data-sermon-preview-state><option data-state="actual" value="/en/">Actual</option><option data-state="empty" value="/en/_preview/sermons/empty/home/">Empty</option><option data-state="recorded" value="/en/_preview/sermons/recorded/home/">Recorded</option></select></nav>' : '<main></main>');
    const visits = [];
    const location = { search, href: `https://preview.example/en/${search}`, origin: "https://preview.example", replace: value => visits.push(value) };
    vm.runInNewContext(source, { document, location, URL, URLSearchParams });
    return { document, window, visits };
  }
  assert.deepEqual(run("?sermon_state=empty").visits, ["/en/_preview/sermons/empty/home/"]);
  assert.deepEqual(run("?sermon_state=recorded").visits, ["/en/_preview/sermons/recorded/home/"]);
  assert.deepEqual(run("?sermon_state=actual").visits, ["/en/"]);
  assert.deepEqual(run("?sermon_state=unknown").visits, []);
  assert.deepEqual(run("?sermon_state=recorded", false).visits, []);
  const changed = run("");
  const picker = changed.document.querySelector("select");
  picker.querySelector('[data-state="recorded"]').setAttribute("selected", "");
  picker.dispatchEvent(new changed.window.Event("change"));
  assert.deepEqual(changed.visits, ["/en/_preview/sermons/recorded/home/"]);
});
