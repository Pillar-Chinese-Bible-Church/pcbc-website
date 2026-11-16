import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Never carry preview-only pages into a later production build.
rmSync("_site", { recursive: true, force: true });
execFileSync(process.execPath, ["node_modules/@11ty/eleventy/cmd.cjs"], { stdio: "inherit" });
