import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import nunjucks from "nunjucks";
import { parseHTML } from "linkedom";
import { assetVersion } from "../lib/assets.js";
import assets from "../src/_data/assets.js";

test("asset versions change when browser scripts or assembled stylesheet inputs change", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pcbc-assets-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "src/assets"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/_includes/styles"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/assets/contact.js"), "old script");
  fs.writeFileSync(path.join(root, "src/_includes/styles/contact.css"), "old CSS");
  fs.writeFileSync(path.join(root, "src/styles.njk"), "old template");
  fs.writeFileSync(path.join(root, "src/lang.njk"), "old language script");
  let before = assetVersion(root);
  assert.equal(assetVersion(root), before, "unchanged content has a stable URL version");
  for (const file of ["src/assets/contact.js", "src/_includes/styles/contact.css", "src/styles.njk", "src/lang.njk"]) {
    fs.appendFileSync(path.join(root, file), " updated");
    const after = assetVersion(root);
    assert.notEqual(after, before, `${file} must invalidate old browser assets`);
    before = after;
  }
});

test("rendered contact markup hides the honeypot without CSS and versions its script", () => {
  const source = fs.readFileSync("src/contact.njk", "utf8").replace(/^---[\s\S]*?---\s*/, "");
  const env = new nunjucks.Environment();
  env.addFilter("t", () => "");
  const { document } = parseHTML(env.renderString(source, { L: { code: "en", prefix: "/en" }, contact: { en: { topics: {} } }, site: { sunday: {} }, assets: assets() }));
  assert.equal(document.querySelector(".contact-trap").hidden, true);
  assert.match(document.querySelector("script[src]").getAttribute("src"), /^\/assets\/contact\.js\?v=[a-f0-9]{16}$/);
  assert.match(fs.readFileSync("src/_includes/base.njk", "utf8"), /site\.css\?v={{ assets\.version }}/);
});
