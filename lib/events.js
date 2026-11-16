// Shared by Eleventy data files and tests. Dates are explicit instants; display is Pacific time.
export function eventData(content, env = process.env, now = Date.now()) {
  const branch = env.CF_PAGES_BRANCH;
  const samples = branch === "live" || branch === "main" ? false :
    (branch && branch !== "main") || env.EVENTS_INCLUDE_SAMPLES === "1";
  const slugs = new Set();
  const items = (content.items || []).map((event) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug) || slugs.has(event.slug)) {
      throw new Error(`Invalid or duplicate event slug: ${event.slug}`);
    }
    slugs.add(event.slug);
    for (const key of ["start", "end"]) {
      if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(event[key]) || !Number.isFinite(Date.parse(event[key]))) {
        throw new Error(`Event ${event.slug} needs an ISO ${key} with a timezone offset`);
      }
    }
    if (Date.parse(event.end) <= Date.parse(event.start)) throw new Error(`Invalid event interval: ${event.slug}`);
    for (const key of ["registration_url", "map_url"]) {
      if (event[key] && !/^https:\/\//i.test(event[key])) throw new Error(`Event ${event.slug}: ${key} must use HTTPS`);
    }
    if (!event.title?.zh || !event.summary?.zh || !event.location?.zh) throw new Error(`Missing event text: ${event.slug}`);
    if (event.image && (!/^\/images\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(event.image) || !event.image_alt?.zh)) {
      throw new Error(`Event ${event.slug} needs a local image and description`);
    }
    return event;
  }).filter((event) => event.published && (!event.sample || samples))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return { items, upcoming: items.filter((event) => Date.parse(event.end) > now).slice(0, 3) };
}

export function formatEventDate(value, lang, timeOnly = false) {
  return new Intl.DateTimeFormat(lang, {
    timeZone: "America/Los_Angeles",
    ...(timeOnly ? { hour: "numeric", minute: "2-digit" } : { year: "numeric", month: "long", day: "numeric", weekday: "short" }),
  }).format(new Date(value));
}
