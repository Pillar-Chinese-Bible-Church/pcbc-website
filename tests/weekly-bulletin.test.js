import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { weeklyBulletin } from "../lib/weekly-bulletin.js";
import { sundayWindow } from "../lib/sermon-calendar.js";
import { onRequest as root } from "../functions/bulletin/index.js";
import { onRequest as english } from "../functions/en/bulletin/index.js";
import { onRequest as traditional } from "../functions/zh-hant/bulletin/index.js";
import { onRequest as rootAlias } from "../functions/bulletin/[[path]].js";
import { onRequest as englishAlias } from "../functions/en/bulletin/[[path]].js";
import { onRequest as traditionalAlias } from "../functions/zh-hant/bulletin/[[path]].js";

// Only the native HTMLRewriter interface is substituted; routing, Responses and
// calendar logic run unchanged. Cloudflare deployment verifies the real runtime.
class Rewriter {
  on(selector, handler) { this.selector = selector; this.handler = handler; return this; }
  async transform(response) {
    const { document } = parseHTML(await response.text());
    for (const element of document.querySelectorAll(this.selector)) this.handler.element({
      setAttribute: (key, value) => element.setAttribute(key, value),
      setInnerContent: value => { element.textContent = value; }
    });
    return new Response(document.toString(), { status: response.status, headers: response.headers });
  }
}
function context(path = "/bulletin/", { dates = [], preview = false, method = "GET", manifest, fail = false } = {}) {
  const visits = [];
  const env = { ASSETS: { async fetch(url) {
    visits.push(url.pathname);
    if (url.pathname === "/assets/bulletins.json") {
      if (fail) throw new Error("asset unavailable");
      return Response.json(manifest ?? { version: 1, preview, dates });
    }
    return new Response('<!doctype html><html><body><time data-bulletin-week datetime="2020-01-05">Old build date</time><h2>Not published yet</h2></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"old"', "Last-Modified": "old", "Content-Length": "100" } });
  } } };
  return { request: new Request(`https://pillarcbc.org${path}`, { method }), env, visits };
}
const monday = Date.parse("2026-11-23T08:00:00Z");
function uncached(response) {
  for (const key of ["Cache-Control", "CDN-Cache-Control", "Cloudflare-CDN-Cache-Control"]) assert.equal(response.headers.get(key), "no-store");
}

test("Pacific Monday–Sunday target handles winter, summer, DST and year boundaries", () => {
  for (const [instant, target] of [
    ["2026-11-23T07:59:59Z", "2026-11-22"], ["2026-11-23T08:00:00Z", "2026-11-29"],
    ["2026-11-29T08:00:00Z", "2026-11-29"], ["2026-11-30T08:00:00Z", "2026-12-06"],
    ["2026-07-06T06:59:59Z", "2026-07-05"], ["2026-07-06T07:00:00Z", "2026-07-12"],
    ["2026-03-08T09:59:59Z", "2026-03-08"], ["2026-03-08T10:00:00Z", "2026-03-08"],
    ["2026-03-09T06:59:59Z", "2026-03-08"], ["2026-03-09T07:00:00Z", "2026-03-15"],
    ["2026-11-01T08:59:59Z", "2026-11-01"], ["2026-11-01T09:00:00Z", "2026-11-01"],
    ["2026-11-02T08:00:00Z", "2026-11-08"], ["2026-12-28T08:00:00Z", "2027-01-03"]
  ]) assert.equal(sundayWindow(Date.parse(instant)).bulletinSunday, target, instant);
});

test("the same deployment stops serving Sunday's bulletin at Pacific Monday midnight", async t => {
  const original = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = Rewriter;
  t.after(() => { if (original === undefined) delete globalThis.HTMLRewriter; else globalThis.HTMLRewriter = original; });
  const ctx = context("/en/bulletin/", { dates: ["2026-11-22", "2026-12-06"] });
  const sunday = await weeklyBulletin(ctx, monday - 1);
  assert.equal(sunday.status, 302);
  assert.equal(sunday.headers.get("Location"), "/en/sermons/2026-11-22/bulletin/");
  const next = await weeklyBulletin(ctx, monday);
  assert.equal(next.status, 200);
  assert.equal(next.headers.get("Location"), null);
  assert.equal(next.headers.get("X-Bulletin-Sunday"), "2026-11-29");
  const html = await next.text();
  assert.match(html, /November 29, 2026/);
  assert.doesNotMatch(html, /Old build date|2026-11-22|2026-12-06/);
  assert.equal(next.headers.get("ETag"), null);
  assert.equal(next.headers.get("Last-Modified"), null);
  assert.equal(next.headers.get("Content-Length"), null);
  uncached(sunday); uncached(next);
});

test("exact-week bulletin redirects in each language and for slash/index aliases", async () => {
  for (const prefix of ["", "/en", "/zh-hant"]) for (const suffix of ["", "/", "/index.html"]) {
    const ctx = context(`${prefix}/bulletin${suffix}`, { dates: ["2026-11-22", "2026-11-29", "2026-12-06"] });
    const response = await weeklyBulletin(ctx, monday);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), `${prefix}/sermons/2026-11-29/bulletin/`);
    assert.deepEqual(ctx.visits, ["/assets/bulletins.json"]);
    uncached(response);
  }
});

test("missing bulletin renders a localized date and never redirects to past or future", async t => {
  const original = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = Rewriter;
  t.after(() => { if (original === undefined) delete globalThis.HTMLRewriter; else globalThis.HTMLRewriter = original; });
  for (const [prefix, language] of [["", "zh-Hans"], ["/en", "en"], ["/zh-hant", "zh-Hant"]]) {
    const ctx = context(`${prefix}/bulletin/`, { dates: ["2026-11-22", "2026-12-06"] });
    const response = await weeklyBulletin(ctx, monday);
    const { document } = parseHTML(await response.text());
    assert.equal(response.status, 200);
    assert.equal(document.querySelector("time").textContent, new Intl.DateTimeFormat(language, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date("2026-11-29T00:00:00Z")));
    assert.deepEqual(ctx.visits, ["/assets/bulletins.json", `${prefix}/bulletin/`]);
    uncached(response);
  }
});

test("manifest failures safely return an empty unavailable response", async t => {
  const original = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = Rewriter;
  t.after(() => { if (original === undefined) delete globalThis.HTMLRewriter; else globalThis.HTMLRewriter = original; });
  for (const options of [{ fail: true }, { manifest: { version: 2, dates: ["2026-11-29"] } }, { manifest: { version: 1, preview: false, dates: "invalid" } }, { manifest: { version: 1, preview: false, dates: ["bad"] } }]) {
    const response = await weeklyBulletin(context("/bulletin/", options), monday);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Location"), null);
    assert.match(await response.text(), /Not published yet/);
    uncached(response);
  }
});

test("fixed-state preview overrides work only on fixture-enabled deployments", async t => {
  const original = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = Rewriter;
  t.after(() => { if (original === undefined) delete globalThis.HTMLRewriter; else globalThis.HTMLRewriter = original; });
  for (const state of ["empty", "current-only", "bulletin", "recorded", "past-only"]) {
    const response = await weeklyBulletin(context(`/en/bulletin/?sermon_state=${state}`, { preview: true }), monday);
    assert.equal(response.headers.get("Location"), `/en/_preview/sermons/${state}/bulletin/`);
    uncached(response);
  }
  for (const [state, preview] of [["recorded", false], ["actual", true], ["unknown", true], ["https://evil.example", true]]) {
    const response = await weeklyBulletin(context(`/bulletin/?sermon_state=${state}`, { preview }), monday);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Location"), null);
  }
});

test("HEAD has matching status/headers and no body; invalid routes and methods are rejected", async () => {
  for (const dates of [[], ["2026-11-29"]]) {
    const response = await weeklyBulletin(context("/en/bulletin/", { dates, method: "HEAD" }), monday);
    assert.equal(response.status, dates.length ? 302 : 200);
    assert.equal(await response.text(), "");
    uncached(response);
  }
  const post = await weeklyBulletin(context("/bulletin/", { method: "POST" }), monday);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, HEAD");
  assert.equal((await weeklyBulletin(context("/bulletin/unexpected/"), monday)).status, 404);
});

test("all six Cloudflare entry points use the shared handler", async () => {
  for (const [handler, path] of [[root, "/bulletin/"], [rootAlias, "/bulletin/index.html"], [english, "/en/bulletin/"], [englishAlias, "/en/bulletin/index.html"], [traditional, "/zh-hant/bulletin/"], [traditionalAlias, "/zh-hant/bulletin/index.html"]]) {
    const response = await handler(context(path, { method: "HEAD" }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("X-Bulletin-Sunday"), /^\d{4}-\d{2}-\d{2}$/);
  }
});
