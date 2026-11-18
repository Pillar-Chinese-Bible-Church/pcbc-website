import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";

function setup(supported = true, total = 3) {
  const buttons = Array.from({ length: total }, (_, i) => `<button class="photo-open" disabled><picture><source srcset="/photo-${i}.webp 1600w" sizes="360px"><img src="/photo-${i}.jpg" alt="Photo ${i}" sizes="360px" loading="lazy"></picture></button>`).join("");
  const { document, Event } = parseHTML(`<html><body><div data-photo-strip>${buttons}</div><dialog id="photo-viewer"><button data-photo-close></button><div data-photo-stage></div><figcaption></figcaption><span data-photo-count></span><button data-photo-prev></button><button data-photo-next></button></dialog></body></html>`);
  const viewer = document.querySelector("dialog");
  let focused;
  document.querySelectorAll(".photo-open").forEach(button => { button.focus = () => { focused = button; }; });
  if (supported) {
    viewer.showModal = () => { viewer.open = true; };
    viewer.close = () => { viewer.open = false; viewer.dispatchEvent(new Event("close")); };
  }
  vm.runInNewContext(fs.readFileSync("src/assets/site.js", "utf8"), { document });
  function key(value) {
    const event = new Event("keydown", { cancelable: true });
    event.key = value;
    viewer.dispatchEvent(event);
    return event;
  }
  return { document, viewer, key, focused: () => focused };
}

test("photo viewer opens selected photo, keeps optimized sources, wraps navigation and restores focus", () => {
  const { document, viewer, key, focused } = setup();
  const buttons = document.querySelectorAll(".photo-open");
  assert.equal(buttons[1].disabled, false);
  buttons[1].click();
  assert.equal(viewer.open, true);
  assert.equal(document.querySelector("figcaption").textContent, "Photo 1");
  assert.equal(document.querySelector("[data-photo-count]").textContent, "2 / 3");
  const image = viewer.querySelector("img");
  assert.equal(image.sizes, "100vw");
  assert.equal(image.loading, "eager");
  assert.equal(viewer.querySelector("source").sizes, "100vw");
  assert.equal(image.getAttribute("src"), "/photo-1.jpg");
  document.querySelector("[data-photo-next]").click();
  assert.equal(document.querySelector("figcaption").textContent, "Photo 2");
  assert.equal(key("ArrowRight").defaultPrevented, true);
  assert.equal(document.querySelector("figcaption").textContent, "Photo 0");
  key("ArrowLeft");
  assert.equal(document.querySelector("figcaption").textContent, "Photo 2");
  document.querySelector("[data-photo-prev]").click();
  assert.equal(document.querySelector("figcaption").textContent, "Photo 1");
  assert.equal(document.documentElement.classList.contains("photo-viewer-open"), true);
  document.querySelector("[data-photo-close]").click();
  assert.equal(viewer.open, false);
  assert.equal(document.documentElement.classList.contains("photo-viewer-open"), false);
  assert.equal(viewer.querySelector("img"), null);
  assert.equal(focused(), buttons[1]);
});

test("photo strip remains unenhanced without dialog support and hides navigation for one photo", () => {
  const unsupported = setup(false);
  assert.equal(unsupported.document.querySelector(".photo-open").disabled, true);
  const single = setup(true, 1);
  assert.equal(single.document.querySelector("[data-photo-next]").hidden, true);
  single.document.querySelector(".photo-open").click();
  assert.equal(single.document.querySelector("figcaption").textContent, "Photo 0");
});
