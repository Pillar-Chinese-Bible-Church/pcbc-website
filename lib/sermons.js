import fs from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readYaml, isHttpsUrl } from "./content.js";
import { timeZone } from "./locales.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
ajv.addFormat("https-url", isHttpsUrl);
const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL("../schemas/sermon-v1.schema.json", import.meta.url), "utf8")));
const DAY = 86400000;
export const HISTORY_WEEKS = 52;
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

// Calendar arithmetic uses UTC only to represent date-only values, never service instants.
export const dateNumber = date => Date.parse(`${date}T00:00:00Z`);
export const dateString = number => new Date(number).toISOString().slice(0, 10);
export function sundayWindow(now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const today = dateNumber(`${parts.year}-${parts.month}-${parts.day}`);
  const sunday = today - new Date(today).getUTCDay() * DAY;
  return { sunday: dateString(sunday), nextSunday: dateString(sunday + 7 * DAY), cutoff: dateString(sunday - (HISTORY_WEEKS - 1) * 7 * DAY) };
}
export function assertSermon(item) {
  if (!validate(item)) throw new Error(`Invalid sermon ${item?.date || "(undated)"}: ${ajv.errorsText(validate.errors)}`);
  if (new Date(dateNumber(item.date)).getUTCDay() !== 0) throw new Error(`Sermon date must be a Sunday: ${item.date}`);
  return item;
}
export function assertSermonCollection(content) {
  if (!content || content.version !== 1 || !Array.isArray(content.items) || typeof content.current_bulletin !== "string" || Object.keys(content).some(key => !["version", "current_bulletin", "items"].includes(key))) throw new Error("Invalid sermons collection: expected version, current_bulletin and items");
  const dates = new Set();
  for (const item of content.items) {
    assertSermon(item);
    if (dates.has(item.date)) throw new Error(`Duplicate sermon date: ${item.date}`);
    dates.add(item.date);
  }
  if (content.current_bulletin && !content.items.some(item => item.date === content.current_bulletin && item.published && item.bulletin)) throw new Error("current_bulletin must reference a published entry with a bulletin");
  return content;
}
export function readSermons(file = "content/sermons.yml") {
  return assertSermonCollection(readYaml(file));
}
export function sermonData(content, now = Date.now()) {
  assertSermonCollection(content);
  const window = sundayWindow(now);
  // Real content never admits samples, even with a preview environment override.
  const items = content.items.filter(item => item.published && !item.sample && item.date >= window.cutoff && item.date <= window.nextSunday && (item.date <= window.sunday || item.date === content.current_bulletin))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, HISTORY_WEEKS);
  const current = items.find(item => item.date === content.current_bulletin && item.date >= window.sunday && item.bulletin) || null;
  const recent = items.filter(item => item.date <= window.sunday && item !== current);
  return { ...window, items, current, recent, latestBulletin: recent.find(item => item.bulletin) || null, hasContent: items.length > 0, preview: false };
}
export function formatSermonDate(date, language) {
  return new Intl.DateTimeFormat(language, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(dateNumber(date)));
}
export function previewAllowed(env = process.env) {
  return !["main", "live"].includes(env.CF_PAGES_BRANCH) && (!!env.CF_PAGES_BRANCH || env.SERMONS_PREVIEW === "1");
}
// Prune the canonical collection explicitly before review/publishing. Builds never rewrite source.
export function pruneSermons(content, now = Date.now()) {
  const retained = new Set(sermonData(content, now).items.map(item => item.date));
  const { sunday } = sundayWindow(now);
  const items = content.items.filter(item => !item.published || item.date > sunday || retained.has(item.date));
  return { version: 1, current_bulletin: items.some(item => item.date === content.current_bulletin) ? content.current_bulletin : "", items };
}
