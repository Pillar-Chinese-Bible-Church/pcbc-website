import fs from "node:fs";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";
import { readEvents } from "../lib/content.js";

export function pruneEvents(file = "content/events.yml", now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error("Cleanup time must be a finite instant");
  const items = readEvents(file);
  const remaining = items.filter(event => Date.parse(event.end) > now);
  const removed = items.length - remaining.length;
  if (removed) fs.writeFileSync(file, yaml.dump({ version: 1, items: remaining }, { lineWidth: 100, noRefs: true }));
  return removed;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Removed ${pruneEvents()} expired events.`);
}
