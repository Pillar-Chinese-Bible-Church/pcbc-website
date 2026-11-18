import fs from "node:fs";
import yaml from "js-yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { locales } from "./locales.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
export function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return /^https:\/\//.test(value) && url.protocol === "https:" && !!url.hostname && !url.username && !url.password && !/\s/.test(value);
  } catch { return false; }
}
ajv.addFormat("https-url", isHttpsUrl);
const validateEvent = ajv.compile(JSON.parse(fs.readFileSync(new URL("../schemas/event-v1.schema.json", import.meta.url), "utf8")));

export function assertEvent(event) {
  if (!validateEvent(event)) throw new Error(`Invalid event ${event?.slug || "(unnamed)"}: ${ajv.errorsText(validateEvent.errors)}`);
  if (![event.start, event.end].every(value => Number.isFinite(Date.parse(value)))) throw new Error(`Invalid event instant: ${event.slug}`);
  if (Date.parse(event.end) <= Date.parse(event.start)) throw new Error(`Invalid event interval: ${event.slug}`);
  return event;
}

export function readYaml(file) {
  return yaml.load(fs.readFileSync(file, "utf8"), { schema: yaml.JSON_SCHEMA });
}

// One canonical collection; never cache across Eleventy watch rebuilds.
export function readEvents(file = "content/events.yml") {
  const data = readYaml(file);
  if (!data || data.version !== 1 || !Array.isArray(data.items) || Object.keys(data).some(key => !["version", "items"].includes(key))) throw new Error("Invalid events collection: expected version: 1 and items");
  const slugs = new Set();
  return data.items.map(value => {
    const event = assertEvent(value);
    if (slugs.has(event.slug)) throw new Error(`Duplicate event slug: ${event.slug}`);
    slugs.add(event.slug);
    return event;
  });
}

// YAML copy uses zh/en, with optional Traditional Chinese overrides. Empty optional copy is allowed.
export function assertLocalizedContent(value, location = "content") {
  if (!value || typeof value !== "object") return;
  const fields = locales.map(locale => locale.field);
  if (fields.some(field => Object.hasOwn(value, field))) {
    for (const field of ["zh", "en"]) {
      if (typeof value[field] !== "string") throw new Error(`${location}.${field} must be translated text`);
    }
    for (const [field, text] of Object.entries(value)) {
      if (!fields.includes(field) || typeof text !== "string") throw new Error(`${location}.${field} is not a supported translation`);
    }
  } else {
    for (const [key, child] of Object.entries(value)) assertLocalizedContent(child, `${location}.${key}`);
  }
}

export function assertInterfaceTranslations(copy, name = "interface") {
  const keys = object => Object.entries(object).flatMap(([key, value]) => typeof value === "string" ? [key] : keys(value).map(child => `${key}.${child}`)).sort();
  const expected = JSON.stringify(keys(copy[locales[0].code]));
  for (const locale of locales) {
    if (!copy[locale.code] || JSON.stringify(keys(copy[locale.code])) !== expected) throw new Error(`${name}: translation keys differ for ${locale.code}`);
  }
}
