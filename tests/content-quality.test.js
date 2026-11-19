import test from "node:test";
import assert from "node:assert/strict";
import { assertRequiredContent } from "../scripts/validate-content.mjs";
import { readYaml } from "../lib/content.js";

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
