import fs from "node:fs";
import yaml from "js-yaml";
import * as OpenCC from "opencc-js";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { eventData, formatEventDate } from "./lib/events.js";
import { readEvents } from "./lib/content.js";
import { readSermons, sermonData, formatSermonDate, previewAllowed } from "./lib/sermons.js";
import { sermonPreviewPages } from "./lib/sermon-previews.js";
import { locales, timeZone } from "./lib/locales.js";
import { validateContent } from "./scripts/validate-content.mjs";

// 简体 → 繁體 (Taiwan characters) for any text an editor left without a 繁體 version.
// "tw" changes characters only; "twp" also swaps vocabulary and turns 信息 into 資訊, which is wrong for church writing.
const opencc = OpenCC.Converter({ from: "cn", to: "tw" });
// OpenCC guesses wrong on a few characters that come up a lot in church writing.
const HANT_FIXES = [
  [/(?<![公英千萬鄰故鄉])里(?![程長])/g, "裡"], // 教會里 → 教會裡, 位格里 → 位格裡 (keeps 公里, 鄰里…)
  [/(?<![宿校寒])舍(?![弟下])/g, "捨"],       // 舍命 → 捨命, 舍己 → 捨己 (keeps 宿舍…)
  [/迴轉/g, "回轉"],
  [/講臺/g, "講台"],
  [/瞭解/g, "了解"],                      // keep 了解, as in the menu wording (了解更多)
  [/聯繫我們/g, "聯絡我們"],                // 联系我们 → 聯絡我們, as in the menu and footer
];
const toHant = (s) => HANT_FIXES.reduce((t, [re, to]) => t.replace(re, to), opencc(s));

const escape = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Pick the right language from a { zh, hant, en } text field.
function pick(field, lang) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  if (lang === "en") return field.en || field.zh || "";
  if (lang === "zh-Hant") return field.hant || toHant(field.zh || "");
  return field.zh || "";
}

export default function (eleventyConfig) {
  // One event snapshot per build, shared by cards, navigation, detail pages and sitemap.
  let events;
  let sermons;
  const getSermons = () => sermons ||= sermonData(readSermons());
  const getEvents = () => events ||= eventData({ items: readEvents() });
  eleventyConfig.on("eleventy.before", () => { events = undefined; sermons = undefined; validateContent(); });
  eleventyConfig.addWatchTarget("content/");
  eleventyConfig.addWatchTarget("schemas/");
  eleventyConfig.addWatchTarget("src/_includes/styles/");
  eleventyConfig.addGlobalData("eventData", getEvents);
  eleventyConfig.addGlobalData("sermonData", getSermons);
  eleventyConfig.addGlobalData("sermonPreviewPages", () => previewAllowed() ? sermonPreviewPages() : []);
  eleventyConfig.addGlobalData("sermonPages", () => getSermons().items.flatMap((sermon, index, items) => locales.flatMap(language => {
    const page = { sermon, language, newer: items[index - 1], older: items[index + 1] };
    return [{ ...page, view: "sermon", path: `/sermons/${sermon.date}/` }, ...(sermon.bulletin ? [{ ...page, view: "bulletin", path: `/sermons/${sermon.date}/bulletin/` }] : [])];
  })));
  eleventyConfig.addGlobalData("eventPages", () => getEvents().items.flatMap(event => locales.map(language => ({ event, language }))));
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));
  eleventyConfig.addFilter("json", value => JSON.stringify(value));
  eleventyConfig.addFilter("absoluteUrl", (value, origin) => new URL(value, origin).href);

  // {{ field | t(lang) }} gives plain text; {{ field | tt(lang) | safe }} also turns line breaks into <br>.
  eleventyConfig.addFilter("t", (field, lang) => pick(field, lang));
  eleventyConfig.addFilter("tt", (field, lang) => escape(pick(field, lang)).replace(/\n/g, "<br>"));
  eleventyConfig.addFilter("hant", (s) => toHant(s || ""));
  eleventyConfig.addFilter("sermonDate", formatSermonDate);
  eleventyConfig.addFilter("eventDate", (s, lang) => formatEventDate(s, lang));
  eleventyConfig.addFilter("eventTime", (s, lang) => formatEventDate(s, lang, true));
  for (const [name, part] of [["eventMonth", "month"], ["eventDay", "day"]]) {
    eleventyConfig.addFilter(name, (s, lang) => new Intl.DateTimeFormat(lang, {
      timeZone, [part]: part === "month" ? "long" : "numeric",
    }).format(new Date(s)));
  }

  // Designer-approved mark, inlined to inherit white in the header and footer.
  const logo = fs.readFileSync("src/images/logo-pillar.svg", "utf8").replace(/<!--[\s\S]*?-->/g, "");
  eleventyConfig.addShortcode("logo", (cls, w, h) =>
    logo.replace("<svg ", `<svg class="${cls}" width="${w}" height="${h}" aria-hidden="true" `));

  // Every <img> is resized into several sizes and re-encoded; this also drops photo metadata such as GPS location.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "jpeg"],
    widths: [480, 960, 1280, 1600],
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "100vw" },
    },
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/_routes.json": "_routes.json" });
  eleventyConfig.addPassthroughCopy({ "src/images/logo-pillar.svg": "images/logo-pillar.svg" });
  eleventyConfig.addPassthroughCopy({ "src/images/favicon.svg": "images/favicon.svg" });
  // Preserve the church's original payment QR image without resizing or recompression.
  eleventyConfig.addPassthroughCopy({ "src/images/giving-zelle.webp": "images/giving-zelle.webp" });

  return {
    dir: { input: "src", output: "_site" },
    templateFormats: ["njk"],
  };
}
