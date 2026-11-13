import fs from "node:fs";
import yaml from "js-yaml";
import * as OpenCC from "opencc-js";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

// 简体 → 繁體 (Taiwan characters) for any text an editor left without a 繁體 version.
// "tw" changes characters only; "twp" also swaps vocabulary and turns 信息 into 資訊, which is wrong for church writing.
const opencc = OpenCC.Converter({ from: "cn", to: "tw" });
// OpenCC guesses wrong on a few characters that come up a lot in church writing.
const HANT_FIXES = [
  [/(?<![公英千萬鄰故鄉])里(?![程長])/g, "裡"], // 教會里 → 教會裡, 位格里 → 位格裡 (keeps 公里, 鄰里…)
  [/(?<![宿校寒])舍(?![弟下])/g, "捨"],       // 舍命 → 捨命, 舍己 → 捨己 (keeps 宿舍…)
  [/迴轉/g, "回轉"],
  [/講臺/g, "講台"],
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
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

  // {{ field | t(lang) }} gives plain text; {{ field | tt(lang) | safe }} also turns line breaks into <br>.
  eleventyConfig.addFilter("t", (field, lang) => pick(field, lang));
  eleventyConfig.addFilter("tt", (field, lang) => escape(pick(field, lang)).replace(/\n/g, "<br>"));
  eleventyConfig.addFilter("hant", (s) => toHant(s || ""));

  // The pillar mark, inlined so it can take the text color (white in the header and footer).
  const logo = fs.readFileSync("src/images/logo-pillar.svg", "utf8").replace(/<!--[\s\S]*?-->/g, "");
  eleventyConfig.addShortcode("logo", (cls, w, h) =>
    logo.replace("<svg ", `<svg class="${cls}" width="${w}" height="${h}" aria-hidden="true" `));

  // Every <img> is resized into several sizes and re-encoded; this also drops photo metadata such as GPS location.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "jpeg"],
    widths: [480, 960, 1600],
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "100vw" },
    },
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/images/logo-pillar.svg": "images/logo-pillar.svg" });

  return {
    dir: { input: "src", output: "_site" },
    templateFormats: ["njk"],
  };
}
