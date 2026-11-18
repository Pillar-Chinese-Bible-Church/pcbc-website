import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import { readEvents } from "../lib/content.js";

// Parser tests use their own records; the church can freely change its real events.
const event = {
  slug: "test-event", published: true, sample: false,
  title: { zh: "活动", en: "Event" },
  summary: { zh: "介绍", en: "Summary" },
  location: { zh: "教会", en: "Church" },
  joining: { zh: "欢迎", en: "Welcome" },
  details: { zh: "活动详情", en: "Event details" },
  start: "2026-12-04T18:30:00-08:00", end: "2026-12-04T20:30:00-08:00",
};
function withCollection(work) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcbc-events-"));
  try {
    const file = path.join(dir, "events.yml");
    const write = value => fs.writeFileSync(file, yaml.dump(value));
    work(file, write);
  } finally { fs.rmSync(dir, { recursive: true }); }
}

test("canonical collection preserves event content, publication flags and stable slugs", () => {
  withCollection((file, write) => {
    const items = [event, { ...event, slug: "draft-event", published: false },
      { ...event, slug: "sample-event", sample: true,
        image: "/images/example.jpg", image_alt: { zh: "照片", en: "Photo" },
        image_position: { x: 0, y: 100 } }];
    write({ version: 1, items });
    assert.deepEqual(readEvents(file), items);
  });
});

test("collections support adding, editing, removing and clearing events", () => {
  withCollection((file, write) => {
    const items = Array.from({ length: 4 }, (_, i) => ({ ...event, slug: `event-${i}` }));
    const edited = items.map((item, i) => i === 1
      ? { ...item, title: { zh: "更新的活动", en: "Updated event" }, published: false }
      : item);
    for (const records of [items.slice(0, 3), items, edited, edited.slice(1), []]) {
      write({ version: 1, items: records });
      assert.deepEqual(readEvents(file), records);
    }
  });
});

test("empty collections are valid; malformed versions, duplicates and invalid events fail the build", () => {
  withCollection((file, write) => {
    for (const value of [{ version: 2, items: [] }, { version: 1, items: [event, event] },
      { version: 1, items: [{ slug: "invalid" }] }, { version: 1, items: [], extra: true }]) {
      write(value);
      assert.throws(() => readEvents(file));
    }
    write({ version: 1, items: [] });
    assert.deepEqual(readEvents(file), []);
  });
});
