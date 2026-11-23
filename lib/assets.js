import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// A new URL prevents browsers from combining a new page with cached old scripts
// or CSS. Include stylesheet modules because Eleventy assembles site.css from them.
export function assetVersion(root = process.cwd()) {
  const hash = createHash("sha256");
  for (const directory of ["src/assets", "src/_includes/styles"]) {
    const base = path.join(root, directory);
    for (const file of fs.readdirSync(base, { recursive: true }).sort()) {
      const full = path.join(base, file);
      if (!fs.statSync(full).isFile()) continue;
      hash.update(`${directory}/${file}\0`);
      hash.update(fs.readFileSync(full));
      hash.update("\0");
    }
  }
  for (const file of ["src/styles.njk", "src/lang.njk"]) hash.update(fs.readFileSync(path.join(root, file)));
  return hash.digest("hex").slice(0, 16);
}
