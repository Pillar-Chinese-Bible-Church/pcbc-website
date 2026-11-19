import test from "node:test";
import assert from "node:assert/strict";
import { eventData, formatEventDate } from "../lib/events.js";

const now = Date.parse("2026-11-16T12:00:00Z");
const event = { slug: "test-event", published: true, sample: false,
  title: { zh: "活动", en: "Event" }, summary: { zh: "介绍", en: "Summary" }, location: { zh: "教会", en: "Church" },
  joining: { zh: "欢迎", en: "Welcome" }, details: { zh: "介绍", en: "Details" },
  start: "2026-12-06T12:30:00-08:00", end: "2026-12-06T14:30:00-08:00" };
test("sample announcements cannot reach live, including an accidental override", () => {
  const content = { items: [{ ...event, sample: true }] };
  for (const env of [{}, { CF_PAGES_BRANCH: "main" }, { CF_PAGES_BRANCH: "main", EVENTS_INCLUDE_SAMPLES: "1" }, { CF_PAGES_BRANCH: "live", EVENTS_INCLUDE_SAMPLES: "1" }]) {
    assert.equal(eventData(content, env, now).items.length, 0);
  }
  assert.equal(eventData(content, { CF_PAGES_BRANCH: "codex/website-events" }, now).items.length, 1);
  assert.equal(eventData(content, { EVENTS_INCLUDE_SAMPLES: "1" }, now).items.length, 1);
});
test("drafts are excluded, upcoming sorts by instant, expired events are excluded from pages and sitemap", () => {
  const content = { items: [event, { ...event, slug: "draft", published: false },
    { ...event, slug: "past", start: "2026-10-01T09:00:00-07:00", end: "2026-10-01T10:00:00-07:00" }] };
  const data = eventData(content, {}, now);
  assert.deepEqual(data.items.map(e => e.slug), ["test-event"]);
  assert.deepEqual(data.upcoming.map(e => e.slug), ["test-event"]);
  assert.equal(eventData({ items: [event] }, {}, Date.parse(event.end)).items.length, 0);
});
test("rejects ambiguous dates, unsafe paths, duplicate IDs and non-HTTPS links", () => {
  for (const change of [{ start: "2026-12-06T12:30:00" }, { end: event.start }, { slug: "../bad" },
    { registration_url: "javascript:alert(1)" }, { map_url: "http://example.com" },
    { image: "/images/../../private.jpg", image_alt: { zh: "照片" } }, { image: "/images/example.jpg" }]) {
    assert.throws(() => eventData({ items: [{ ...event, ...change }] }, {}, now));
  }
  assert.throws(() => eventData({ items: [event, event] }, {}, now));
});
test("dates use Pacific time across UTC midnight and daylight saving", () => {
  assert.match(formatEventDate("2026-12-07T01:00:00Z", "en"), /December 6/);
  assert.match(formatEventDate("2026-07-01T16:00:00Z", "en", true), /9:00/);
  assert.match(formatEventDate("2026-12-01T16:00:00Z", "en", true), /8:00/);
});

test("strict schema rejects string booleans, impossible dates, incomplete URLs and missing translations", () => {
  for (const change of [
    { published: "false" }, { sample: "false" }, { start: "2027-02-30T10:00:00-08:00", end: "2027-03-03T10:00:00-08:00" },
    { start: "2027-13-01T10:00:00Z" }, { map_url: "https://" }, { registration_url: "https://user:secret@example.com" },
    { title: { zh: "活动" } }, { title: { zh: "活动", en: "   " } }, { surprise: true },
  ]) assert.throws(() => eventData({ items: [{ ...event, ...change }] }, {}, now));
  assert.doesNotThrow(() => eventData({ items: [{ ...event, map_url: "https://example.com/location?a=1&b=2" }] }, {}, now));
});

test("all upcoming events survive the build; latest end accounts for overlapping events", () => {
  const items = Array.from({ length: 5 }, (_, index) => ({ ...event, slug: `event-${index}`, start: `2026-12-${String(index + 6).padStart(2, "0")}T12:30:00-08:00`, end: `2026-12-${String(index + 6).padStart(2, "0")}T14:30:00-08:00` }));
  items[0].end = "2026-12-20T14:30:00-08:00";
  const data = eventData({ items }, {}, now);
  assert.equal(data.upcoming.length, 5);
  assert.equal(data.latestEnd, items[0].end);
});

test("image framing is optional, bounded and requires an image", () => {
  const image = { image: "/images/example.jpg", image_alt: { zh: "照片", en: "Photo" } };
  assert.deepEqual(eventData({ items: [{ ...event, ...image, image_position: { x: 0, y: 100 } }] }, {}, now).items[0].image_position, { x: 0, y: 100 });
  for (const image_position of [{ x: -1, y: 50 }, { x: 50, y: 101 }, { x: "50", y: 50 }, { x: 50 }, { x: 50, y: 50, extra: true }])
    assert.throws(() => eventData({ items: [{ ...event, ...image, image_position }] }, {}, now));
  assert.throws(() => eventData({ items: [{ ...event, image_position: { x: 0, y: 0 } }] }, {}, now));
});
test("event cards render saved framing including zero coordinates, with a centered legacy fallback", async () => {
  const { default: nunjucks } = await import("nunjucks");
  const { readFileSync } = await import("node:fs");
  const env = new nunjucks.Environment(null, { autoescape: true });
  env.addFilter("t", value => value.en);
  for (const name of ["eventMonth", "eventDay", "eventDate", "eventTime"]) env.addFilter(name, () => "Date");
  const template = readFileSync("src/_includes/events.njk", "utf8");
  const render = (position) => env.renderString(template, {
    eventData: { upcoming: [{ ...event, image: "/images/example.jpg", image_position: position }] },
    events: { heading: { en: "Events" }, intro: { en: "Upcoming" } }, L: { prefix: "/en" },
    u: { events: { previous: "Previous", next: "Next", details: "Details" } }, c: "en",
  });
  assert.match(render({ x: 0, y: 100 }), /style="object-position: 0% 100%"/);
  assert.doesNotMatch(render(undefined), /object-position:/);
});
