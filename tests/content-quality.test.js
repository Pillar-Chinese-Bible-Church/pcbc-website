import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import { assertRequiredContent } from "../scripts/validate-content.mjs";
import { readYaml, readEvents } from "../lib/content.js";
import { pruneEvents } from "../scripts/prune-events.mjs";

test("required content rejects deleted fields, empty translations and malformed lists", () => {
  const homepage = readYaml("src/_data/homepage.yml");
  const site = readYaml("src/_data/site.yml");
  for (const value of [undefined, null, "Untranslated title", { zh: "标题", en: "  " }, {}]) {
    const changed = structuredClone(homepage);
    changed.hero.title = value;
    assert.throws(() => assertRequiredContent(changed, "homepage.yml"), /hero.title/);
  }
  delete site.email;
  assert.throws(() => assertRequiredContent(site, "site.yml"), /email/);
  homepage.week.gatherings = {};
  assert.throws(() => assertRequiredContent(homepage, "homepage.yml"), /expected a list/);
  const optional = readYaml("src/_data/homepage.yml");
  optional.week.intro = { zh: "", en: "" };
  assert.doesNotThrow(() => assertRequiredContent(optional, "homepage.yml"));
});

test("cleanup deletes expired published, sample and draft records and is idempotent", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcbc-cleanup-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "events.yml");
  const base = readEvents()[0];
  const now = Date.parse("2026-11-19T20:00:00Z");
  const old = { ...base, start: "2026-11-18T18:00:00Z", end: "2026-11-19T20:00:00Z" };
  const future = { ...base, slug: "future", start: "2027-01-01T18:00:00Z", end: "2027-01-01T20:00:00Z" };
  fs.writeFileSync(file, yaml.dump({ version: 1, items: [
    { ...old, slug: "old", sample: false }, { ...old, slug: "sample", sample: true },
    { ...old, slug: "draft", published: false }, future,
  ] }));
  assert.equal(pruneEvents(file, now), 3);
  assert.deepEqual(readEvents(file), [future]);
  const unchanged = fs.readFileSync(file, "utf8");
  assert.equal(pruneEvents(file, now), 0);
  assert.equal(fs.readFileSync(file, "utf8"), unchanged);
  assert.equal(pruneEvents(file, Date.parse(future.end)), 1);
  assert.deepEqual(readEvents(file), []);
});
