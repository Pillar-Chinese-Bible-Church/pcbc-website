import { assertEvent } from "./content.js";
import { timeZone } from "./locales.js";

// Shared by Eleventy data files and tests. Dates are explicit instants; display is Pacific time.
export function eventData(content, env = process.env, now = Date.now()) {
  const branch = env.CF_PAGES_BRANCH;
  const samples = branch === "live" || branch === "main" ? false :
    (branch && branch !== "main") || env.EVENTS_INCLUDE_SAMPLES === "1";
  const slugs = new Set();
  const items = (content.items || []).map((event) => {
    assertEvent(event);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug) || slugs.has(event.slug)) {
      throw new Error(`Invalid or duplicate event slug: ${event.slug}`);
    }
    slugs.add(event.slug);
    return event;
  }).filter((event) => event.published && (!event.sample || samples) && Date.parse(event.end) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const upcoming = items.filter(event => Date.parse(event.end) > now);
  return { items, upcoming, latestEnd: upcoming.reduce((latest, event) => Date.parse(event.end) > Date.parse(latest) ? event.end : latest, upcoming[0]?.end) };
}

export function formatEventDate(value, lang, timeOnly = false) {
  return new Intl.DateTimeFormat(lang, {
    timeZone,
    ...(timeOnly ? { hour: "numeric", minute: "2-digit" } : { year: "numeric", month: "long", day: "numeric", weekday: "short" }),
  }).format(new Date(value));
}
