import { isHttpsUrl } from "../../lib/content.js";

export default function () {
  const url = process.env.SITE_URL || "https://pillarcbc.org";
  if (!isHttpsUrl(url) || new URL(url).pathname !== "/" || new URL(url).search || new URL(url).hash) {
    throw new Error("SITE_URL must be an HTTPS production origin without a path, query or fragment");
  }
  return { url: new URL(url).origin };
}
