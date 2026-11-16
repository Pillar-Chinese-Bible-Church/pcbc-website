import test from "node:test";
import assert from "node:assert/strict";
import { eventData, formatEventDate } from "../lib/events.js";

const now = Date.parse("2026-11-16T12:00:00Z");
const event = { slug: "test-event", published: true, sample: false,
  title: { zh: "活动" }, summary: { zh: "介绍" }, location: { zh: "教会" },
  start: "2026-12-06T12:30:00-08:00", end: "2026-12-06T14:30:00-08:00" };
test("sample announcements cannot reach live, including an accidental override", () => {
  const content = { items: [{ ...event, sample: true }] };
  for (const env of [{}, { CF_PAGES_BRANCH: "main" }, { CF_PAGES_BRANCH: "main", EVENTS_INCLUDE_SAMPLES: "1" }, { CF_PAGES_BRANCH: "live", EVENTS_INCLUDE_SAMPLES: "1" }]) {
    assert.equal(eventData(content, env, now).items.length, 0);
  }
  assert.equal(eventData(content, { CF_PAGES_BRANCH: "codex/website-events" }, now).items.length, 1);
  assert.equal(eventData(content, { EVENTS_INCLUDE_SAMPLES: "1" }, now).items.length, 1);
});
test("drafts are excluded, upcoming sorts by instant, past detail pages remain available", () => {
  const content = { items: [event, { ...event, slug: "draft", published: false },
    { ...event, slug: "past", start: "2026-10-01T09:00:00-07:00", end: "2026-10-01T10:00:00-07:00" }] };
  const data = eventData(content, {}, now);
  assert.deepEqual(data.items.map(e => e.slug), ["past", "test-event"]);
  assert.deepEqual(data.upcoming.map(e => e.slug), ["test-event"]);
  assert.equal(eventData({ items: [event] }, {}, Date.parse(event.end)).upcoming.length, 0);
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
