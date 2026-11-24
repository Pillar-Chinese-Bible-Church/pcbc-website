import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { locales } from "../lib/locales.js";
import { readEvents } from "../lib/content.js";
import { readSermons, sermonData } from "../lib/sermons.js";

export function checkSite(directory = "_site", production = false) {
  const root = path.resolve(directory);
  const files = fs.readdirSync(root, { recursive: true }).filter(name => name.endsWith(".html"));
  const pages = new Map(files.map(file => [path.join(root, file), parseHTML(fs.readFileSync(path.join(root, file), "utf8")).document]));
  for (const [file, document] of pages) {
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    assert.equal(!!document.querySelector("[data-sermon-preview-controls]"), !production, `${relative}: preview state controls must appear on feature pages only`);
    assert.equal(!!document.querySelector('script[src^="/assets/sermon-preview.js"]'), !production, `${relative}: preview state script must never run in production`);
    const pageUrl = new URL(relative.replace(/index\.html$/, ""), "https://local.invalid/");
    assert.equal(document.querySelectorAll("main#main").length, 1, `${relative}: needs one main landmark`);
    assert.equal(document.querySelectorAll("h1").length, 1, `${relative}: needs one primary heading`);
    assert.ok(document.querySelector("h1")?.textContent.trim(), `${relative}: primary heading is empty`);
    for (const link of document.querySelectorAll('a[href^="mailto:"]')) {
      assert.match(link.getAttribute("href"), /^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+(?:\?|$)/, `${relative}: invalid email link`);
    }
    const languageScript = [...document.querySelectorAll("script[src]")].find(element =>
      new URL(element.getAttribute("src"), pageUrl).pathname === "/assets/lang.js");
    for (const element of document.querySelectorAll('script[src^="/assets/"], link[rel="stylesheet"][href^="/assets/"]')) {
      const target = new URL(element.getAttribute("src") || element.getAttribute("href"), pageUrl);
      assert.match(target.searchParams.get("v") || "", /^[a-f0-9]{16}$/, `${relative}: unversioned asset ${target.pathname}`);
    }
    assert.equal(!!languageScript, relative === "index.html", `${relative}: language detection belongs only on /`);
    const ids = [...document.querySelectorAll("[id]")].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length, `${relative}: duplicate IDs`);
    assert.ok(document.querySelector('meta[name="description"]')?.content.trim(), `${relative}: missing description`);
    for (const element of document.querySelectorAll('link[rel="canonical"], link[hreflang]')) {
      assert.match(element.getAttribute("href"), /^https:\/\//, `${relative}: metadata URL must be absolute`);
    }
    for (const card of document.querySelectorAll(".event-card")) {
      assert.ok(card.querySelector(".event-card-header .event-date-badge span")?.textContent.trim(), `${relative}: event month badge missing`);
      assert.ok(card.querySelector(".event-card-header .event-date-badge strong")?.textContent.trim(), `${relative}: event day badge missing`);
    }
    for (const element of document.querySelectorAll("a[href], link[href], script[src], img[src], source[srcset], img[srcset]")) {
      const references = element.getAttribute("srcset") ? element.getAttribute("srcset").split(",").map(item => item.trim().split(/\s+/)[0]) : [element.getAttribute("href") || element.getAttribute("src")];
      for (const reference of references) {
        const target = new URL(reference, pageUrl);
        if (target.origin !== pageUrl.origin) continue;
        let destination = path.resolve(root, `.${decodeURIComponent(target.pathname)}`);
        assert.ok((destination === root || destination.startsWith(`${root}${path.sep}`)), `${relative}: link escapes output`);
        if (fs.existsSync(destination) && fs.statSync(destination).isDirectory()) destination = path.join(destination, "index.html");
        assert.ok(fs.existsSync(destination), `${relative}: broken link ${reference}`);
        if (target.hash && pages.has(destination)) assert.ok(pages.get(destination).getElementById(decodeURIComponent(target.hash.slice(1))), `${relative}: missing anchor ${reference}`);
      }
    }
  }
  if (production) {
    assert.ok(!files.some(file => file.replaceAll(path.sep, "/").includes("_preview/sermons/")), "Sermon preview routes leaked into production");
    const retained = new Set(sermonData(readSermons()).items.map(entry => entry.date));
    for (const entry of readSermons().items.filter(entry => !retained.has(entry.date))) {
      for (const locale of locales) assert.ok(!fs.existsSync(path.join(root, locale.prefix, "sermons", entry.date)), `Excluded sermon leaked into production: ${entry.date}`);
    }
    for (const event of readEvents().filter(event => event.sample || !event.published || Date.parse(event.end) <= Date.now())) {
      for (const locale of locales) assert.ok(!fs.existsSync(path.join(root, locale.prefix, "events", event.slug, "index.html")), `Excluded event leaked into production: ${event.slug}`);
    }
    for (const document of pages.values()) assert.equal(document.querySelectorAll(".sample-label").length, 0, "Sample copy leaked into production");
  }
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.ok(sitemap.includes("<urlset"), "Sitemap missing");
  for (const match of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const destination = path.join(root, new URL(match[1]).pathname, "index.html");
    assert.ok(fs.existsSync(destination), `Sitemap points at a missing page: ${match[1]}`);
  }
  console.log(`Checked ${pages.size} pages: links, images, anchors, metadata${production ? ", production exclusions" : ""}.`);
}
