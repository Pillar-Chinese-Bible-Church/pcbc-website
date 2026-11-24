import { sundayWindow, formatSermonDate } from "./sermon-calendar.js";

const states = new Set(["empty", "current-only", "bulletin", "recorded", "past-only"]);
function headers(extra = {}) {
  return { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store", "Cloudflare-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra };
}

export async function weeklyBulletin({ request, env }, now = Date.now()) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^(\/en|\/zh-hant)?\/bulletin(?:\/|\/index\.html)?$/);
  if (!match) return new Response(null, { status: 404, headers: headers() });
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: headers({ Allow: "GET, HEAD" }) });
  const prefix = match[1] || "";
  const language = prefix === "/en" ? "en" : prefix === "/zh-hant" ? "zh-Hant" : "zh-Hans";
  const date = sundayWindow(now).bulletinSunday;
  let manifest;
  let unavailable = false;
  try {
    const response = await env.ASSETS.fetch(new URL("/assets/bulletins.json", url));
    if (!response.ok) throw new Error("manifest_unavailable");
    manifest = await response.json();
    if (manifest.version !== 1 || typeof manifest.preview !== "boolean" || !Array.isArray(manifest.dates) || !manifest.dates.every(value => /^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error("manifest_invalid");
  } catch { manifest = undefined; unavailable = true; }

  // Keep fixed-state review URLs working, but only on builds that actually contain fixtures.
  const state = url.searchParams.get("sermon_state");
  if (manifest?.preview && states.has(state)) {
    return new Response(null, { status: 302, headers: headers({ Location: `${prefix}/_preview/sermons/${state}/bulletin/` }) });
  }
  if (manifest?.dates.includes(date)) {
    return new Response(null, { status: 302, headers: headers({ Location: `${prefix}/sermons/${date}/bulletin/`, "X-Bulletin-Sunday": date }) });
  }

  // The static fallback is always empty, so fail-open hosting cannot expose an old bulletin.
  const fallback = await env.ASSETS.fetch(new URL(`${prefix}/bulletin/`, url));
  const responseHeaders = new Headers(fallback.headers);
  for (const [key, value] of Object.entries(headers({ "X-Bulletin-Sunday": date }))) responseHeaders.set(key, value);
  for (const key of ["ETag", "Last-Modified", "Content-Length"]) responseHeaders.delete(key);
  const response = new Response(request.method === "HEAD" ? null : fallback.body, { status: unavailable ? 503 : fallback.status, headers: responseHeaders });
  if (request.method === "HEAD") return response;
  return new HTMLRewriter().on("[data-bulletin-week]", {
    element(element) {
      element.setAttribute("datetime", date);
      element.setInnerContent(formatSermonDate(date, language));
    }
  }).transform(response);
}
