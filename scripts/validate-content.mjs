import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readYaml, readEvents, assertLocalizedContent, assertInterfaceTranslations, isHttpsUrl } from "../lib/content.js";
import { eventData } from "../lib/events.js";
import ui from "../src/_data/ui.js";
import contact from "../src/_data/contact.js";

function inspect(value, location) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const field = `${location}.${key}`;
    if (["image", "qr_image"].includes(key)) {
      if (typeof child !== "string" || !/^\/images\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/.test(child) || !fs.existsSync(`src${child}`)) {
        throw new Error(`${field}: image must exist in src/images`);
      }
    }
    if (["map_link", "map_url", "registration_url", "youtube", "wechat", "xiaohongshu"].includes(key) && child && !isHttpsUrl(child)) {
      throw new Error(`${field}: expected a complete HTTPS URL`);
    }
    if (["email", "zelle_email", "office_email"].includes(key) && (typeof child !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(child))) {
      throw new Error(`${field}: expected an email address`);
    }
    inspect(child, field);
  }
}
// Only required copy is constrained here; optional introductions/notes may stay empty.
const required = {
  "site.yml": ["name", "address", "map_link", "email", "sunday.time", "sunday.place", "sunday.note"],
  "homepage.yml": ["hero.title", "hero.subtitle", "hero.button", "hero.about_button", "hero.image", "hero.image_alt", "sunday.heading", "sunday.image", "sunday.image_alt", "week.heading", "verse.text", "verse.reference", "values.heading", "values.mission", "values.button"],
  "about.yml": ["title", "intro", "mission.heading", "mission.text", "mission.welcome", "pastor.name", "pastor.role", "pastor.bio", "pastor.email", "pastor.image", "pastor.image_alt", "life.heading"],
  "beliefs.yml": ["title", "intro", "question", "button"],
  "events.yml": ["heading", "intro"],
  "photos.yml": ["label"],
  "giving.yml": ["title", "intro", "payee", "zelle_email", "office_email", "qr_image", "qr_alt", "methods_heading"],
};
const lists = {
  "homepage.yml": { "week.gatherings": ["name", "time"] },
  "about.yml": { "life.rows": ["title", "text", "image", "image_alt"] },
  "beliefs.yml": { items: ["title", "text", "refs"] },
  "values.yml": { items: ["title", "summary", "text", "refs"] },
  "photos.yml": { strip: ["image", "alt"] },
};
const at = (value, key) => key.split(".").reduce((child, part) => child?.[part], value);
export function assertRequiredContent(value, name) {
  function requireField(parent, key, location) {
    const field = at(parent, key);
    const plain = /(?:^|\.)(?:address|map_link|email|image|zelle_email|office_email|qr_image|payee)$/.test(key) || (name === "site.yml" && key === "sunday.place");
    const text = plain ? [field] : [field?.zh, field?.en];
    if (!text.every(item => typeof item === "string" && item.trim())) throw new Error(`${location}.${key}: required text is missing or empty`);
    // Localized fields must not silently become untranslated strings.
    if (typeof field === "object") assertLocalizedContent(field, `${location}.${key}`);
  }
  for (const key of required[name] || []) requireField(value, key, name);
  for (const [key, fields] of Object.entries(lists[name] || {})) {
    const items = at(value, key);
    if (!Array.isArray(items)) throw new Error(`${name}.${key}: expected a list`);
    items.forEach((item, index) => fields.forEach(field => requireField(item, field, `${name}.${key}[${index}]`)));
  }
}
export function validateContent() {
  for (const name of new Set([...Object.keys(required), ...Object.keys(lists), ...fs.readdirSync("src/_data").filter(name => name.endsWith(".yml"))])) {
    const value = readYaml(path.join("src/_data", name));
    assertRequiredContent(value, name);
    assertLocalizedContent(value, name);
    inspect(value, name);
  }
  const items = readEvents();
  eventData({ items }, { CF_PAGES_BRANCH: "live" }); // Includes duplicates and interval checks, even for drafts.
  for (const event of items) inspect(event, `events.${event.slug}`);
  assertInterfaceTranslations(ui, "ui");
  assertInterfaceTranslations(contact, "contact");
  // Keep CMS collection fields aligned with the shared event schema.
  const cms = readYaml(".pages.yml");
  const collection = cms.content.find(entry => entry.name === "events");
  const schema = JSON.parse(fs.readFileSync("schemas/event-v1.schema.json", "utf8"));
  if (collection?.type !== "file" || collection.path !== "content/events.yml") throw new Error("CMS event collection path is out of sync");
  for (const field of Object.keys(schema.properties)) {
    if (!collection.fields.find(item => item.name === "items")?.fields.some(item => item.name === field)) throw new Error(`CMS is missing event field ${field}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateContent();
  console.log("Content, translations, images and CMS configuration validated.");
}
