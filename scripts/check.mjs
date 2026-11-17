import { execFileSync } from "node:child_process";
import { validateContent } from "./validate-content.mjs";
import { checkSite } from "./check-site.mjs";

validateContent();
const tests = (await import("node:fs")).readdirSync("tests").filter(name => name.endsWith(".test.js")).map(name => `tests/${name}`);
execFileSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
for (const branch of ["live", "codex/check-preview"]) {
  execFileSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit", env: { ...process.env, CF_PAGES_BRANCH: branch } });
  checkSite("_site", branch === "live");
}
