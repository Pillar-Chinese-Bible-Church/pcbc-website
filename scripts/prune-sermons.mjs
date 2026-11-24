import fs from "node:fs";
import yaml from "js-yaml";
import { readSermons, pruneSermons } from "../lib/sermons.js";

const file = "content/sermons.yml";
const before = readSermons(file);
const after = pruneSermons(before);
if (JSON.stringify(before) !== JSON.stringify(after)) {
  fs.writeFileSync(file, yaml.dump(after, { lineWidth: 100, noRefs: true }));
}
console.log(`Retained ${after.items.length} entries; removed ${before.items.length - after.items.length} expired published entries. Review and publish this change normally.`);
