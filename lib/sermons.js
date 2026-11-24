import fs from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readYaml, isHttpsUrl } from "./content.js";
import { sundayWindow, HISTORY_WEEKS, dateNumber } from "./sermon-calendar.js";
export { sundayWindow, HISTORY_WEEKS, dateNumber, dateString, formatSermonDate } from "./sermon-calendar.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
ajv.addFormat("https-url", isHttpsUrl);
const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL("../schemas/sermon-v1.schema.json", import.meta.url), "utf8")));
export const SERMONS_PER_PAGE = 6;

// Static, shareable archive pages; no browser JavaScript or database query needed.
export function paginatePastSermons(items) {
  const count = Math.max(1, Math.ceil(items.length / SERMONS_PER_PAGE));
  const pages = Array.from({ length: count }, (_, index) => ({
    number: index + 1, path: index === 0 ? "/sermons/" : `/sermons/page/${index + 1}/`
  }));
  return pages.map((page, index) => ({
    ...page, pages, totalPages: count, totalItems: items.length,
    items: items.slice(index * SERMONS_PER_PAGE, (index + 1) * SERMONS_PER_PAGE),
    previous: pages[index - 1] || null, next: pages[index + 1] || null
  }));
}
export function sermonArchiveReturn(data, date) {
  if (!data || !date) return "/sermons/";
  if (data.current?.date === date) return "/sermons/#current-sunday";
  const page = paginatePastSermons(data.recent).find(page => page.items.some(item => item.date === date));
  return page ? `${page.path}#past-sermons` : "/sermons/";
}

export function assertSermon(item) {
  if (!validate(item)) throw new Error(`Invalid sermon ${item?.date || "(undated)"}: ${ajv.errorsText(validate.errors)}`);
  if (new Date(dateNumber(item.date)).getUTCDay() !== 0) throw new Error(`Sermon date must be a Sunday: ${item.date}`);
  return item;
}
export function assertSermonCollection(content) {
  if (!content || content.version !== 1 || !Array.isArray(content.items) || Object.keys(content).some(key => !["version", "items"].includes(key))) throw new Error("Invalid sermons collection: expected version and items");
  const dates = new Set();
  for (const item of content.items) {
    assertSermon(item);
    if (dates.has(item.date)) throw new Error(`Duplicate sermon date: ${item.date}`);
    dates.add(item.date);
  }
  return content;
}
export function readSermons(file = "content/sermons.yml") {
  return assertSermonCollection(readYaml(file));
}
export function sermonData(content, now = Date.now()) {
  assertSermonCollection(content);
  const window = sundayWindow(now);
  // Prebuild published future dated pages so the weekly route can roll over without a rebuild.
  const datedItems = content.items.filter(item => item.published && !item.sample && item.date >= window.cutoff)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, HISTORY_WEEKS);
  const items = datedItems.filter(item => item.date <= window.bulletinSunday);
  const current = items.find(item => item.date === window.bulletinSunday) || null;
  const recent = items.filter(item => item !== current);
  return { ...window, items, datedItems, current, recent, hasContent: items.length > 0, preview: false };
}

export function previewAllowed(env = process.env) {
  return !["main", "live"].includes(env.CF_PAGES_BRANCH) && (!!env.CF_PAGES_BRANCH || env.SERMONS_PREVIEW === "1");
}
// Prune the canonical collection explicitly before review/publishing. Builds never rewrite source.
export function pruneSermons(content, now = Date.now()) {
  const retained = new Set(sermonData(content, now).items.map(item => item.date));
  const { sunday } = sundayWindow(now);
  const items = content.items.filter(item => !item.published || item.date > sunday || retained.has(item.date));
  return { version: 1, items };
}
