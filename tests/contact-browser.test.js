import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";
const tick = () => new Promise(resolve => setImmediate(resolve));
async function page(result = { code: "accepted" }, available = true, loadScript = true) {
  const { document } = parseHTML(`<html><head></head><body><form id="contact-form" action="/api/contact" data-language="en" data-sending="Sending" data-success="Success" data-unavailable="Unavailable" data-error="Error" data-verification="Verify" data-rate-limited="Wait" data-loading="Loading" data-verified="Verified" data-retry-verification="Retry" data-verification-retry="Retry verification" data-verification-expired="Expired"><input name="name" value="Visitor"><input name="email" value="visitor@example.com"><select id="contact-topic" name="topic"><option value="visit">Visit</option></select><textarea id="contact-message" name="message">Sunday visit question</textarea><input name="website" value=""><button id="contact-retry" type="button" hidden>Retry</button><div id="contact-verification"></div><p id="contact-status">Verify</p><button type="submit" disabled>Send</button></form><span id="message-count"></span><span id="contact-context"></span><p class="contact-context" hidden></p><a data-lang href="https://pillarcbc.org/zh-hant/contact/">繁</a></body></html>`);
  const form = document.getElementById("contact-form");
  form.reportValidity = () => true;
  form.reset = () => { document.getElementById("contact-message").value = ""; };
  document.getElementById("contact-status").focus = () => {};
  let callbacks, posts = 0, resolves = [], renderCount = 0, removed = 0, requests = 0;
  const timers = new Map();
  let timerId = 0;
  const turnstile = { render: (_, options) => { callbacks = options; renderCount++; return renderCount; }, execute: () => { throw new Error("Native widget must not need a custom execute call"); }, remove: () => { removed++; } };
  const window = { location: { search: "?topic=visit&regarding=Sunday" }, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(fs.readFileSync("src/assets/contact.js", "utf8"), {
    document, URL, URLSearchParams, AbortSignal, AbortController, window,
    FormData: class { get(key) { return form.querySelector(`[name="${key}"]`).value; } },
    fetch: async (_, options) => {
      requests++;
      if (!options.method) return { ok: available, json: async () => ({ siteKey: "public" }) };
      posts++;
      return new Promise(resolve => resolves.push(() => resolve({ ok: result.code === "accepted", json: async () => result })));
    },
  });
  const event = name => new document.defaultView.Event(name, { cancelable: true });
  const verify = document.getElementById("contact-retry");
  async function load() {
    await tick();
    if (available && loadScript && document.querySelector("script")?.onload) {
      window.turnstile = turnstile;
      document.querySelector("script").onload();
      await tick();
    }
  }
  await load();
  return {
    document, form, status: document.getElementById("contact-status"), button: form.querySelector("[type=submit]"), verify,
    requests: () => requests, posts: () => posts, callbacks: () => callbacks, renders: () => renderCount, removed: () => removed,
    expire: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(f => f()); },
    start: async () => { verify.dispatchEvent(event("click")); await load(); },
    success: () => callbacks.callback("token"), finish: () => resolves.shift()(), submit: () => form.dispatchEvent(event("submit")),
  };
}
test("native widget initializes early and gates Send without an extra start click", async () => {
  const ui = await page();
  assert.equal(ui.requests(), 1);
  assert.equal(ui.renders(), 1);
  assert.equal(ui.verify.hidden, true);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.callbacks().execution, "render");
  assert.equal(ui.callbacks().appearance, "always");
  assert.equal(ui.callbacks().retry, "auto");
  assert.equal(ui.callbacks()["refresh-expired"], "auto");
  ui.submit(); assert.equal(ui.posts(), 0);
  // The app must not kill a native checkbox while the visitor is using it.
  ui.expire(); assert.equal(ui.removed(), 0);
  ui.success();
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.status.textContent, "Verified");
});
test("configuration failure offers a retry without losing fields", async () => {
  const ui = await page({}, false);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.verify.hidden, false);
  assert.equal(ui.status.textContent, "Retry verification");
  assert.equal(ui.document.getElementById("contact-message").value, "Sunday visit question");
});
test("stalled script times out and can be retried without a reload", async () => {
  const ui = await page({}, true, false);
  ui.expire();
  assert.equal(ui.status.textContent, "Retry verification");
  assert.equal(ui.verify.hidden, false);
  assert.equal(ui.button.disabled, true);
  await ui.start(); assert.equal(ui.status.textContent, "Loading");
  assert.equal(ui.requests(), 2);
});
test("old widget callbacks cannot unlock Send after a manual recovery", async () => {
  const ui = await page(); const old = ui.callbacks();
  old["error-callback"]();
  assert.equal(ui.verify.hidden, false);
  await ui.start();
  assert.equal(ui.removed(), 1);
  old.callback("stale"); old["error-callback"]();
  assert.equal(ui.status.textContent, "Verify");
  assert.equal(ui.button.disabled, true);
  ui.success(); assert.equal(ui.button.disabled, false);
});
test("native errors, expiry, and timeout disable Send until a fresh successful callback", async () => {
  for (const event of ["expired-callback", "timeout-callback", "error-callback"]) {
    const ui = await page(); ui.success(); ui.callbacks()[event]();
    assert.equal(ui.button.disabled, true);
    ui.submit(); assert.equal(ui.posts(), 0);
    ui.success(); assert.equal(ui.button.disabled, false);
  }
});
test("duplicate send clicks are ignored and success cannot be sent twice", async () => {
  const ui = await page(); ui.success(); ui.submit(); ui.submit();
  assert.equal(ui.posts(), 1); assert.equal(ui.button.disabled, true);
  ui.finish(); await tick();
  assert.equal(ui.status.textContent, "Success");
  assert.equal(ui.document.getElementById("contact-message").value, "");
  ui.submit(); assert.equal(ui.posts(), 1);
});
test("failed sends preserve content and reinitialize native verification without sending again", async () => {
  for (const [code, text] of [["send_failed", "Error"], ["rate_limited", "Wait"], ["verification_failed", "Verify"]]) {
    const ui = await page({ code }); ui.success();
    ui.submit(); ui.finish(); await tick();
    assert.equal(ui.status.textContent, text);
    assert.equal(ui.document.getElementById("contact-message").value, "Sunday visit question");
    assert.equal(ui.button.disabled, true);
    assert.equal(ui.renders(), 2);
    ui.submit(); assert.equal(ui.posts(), 1);
    ui.success(); assert.equal(ui.button.disabled, false);
  }
});
