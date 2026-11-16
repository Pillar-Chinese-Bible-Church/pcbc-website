import fs from "node:fs";
import yaml from "js-yaml";
import { eventData } from "../../lib/events.js";

export default function () {
  return eventData(yaml.load(fs.readFileSync("src/_data/events.yml", "utf8")));
}
