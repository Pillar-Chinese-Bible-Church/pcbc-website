import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";
const tick = () => new Promise(resolve => setImmediate(resolve));
async function page(result = { code: "accepted" }, available = true, loadScript = true) {
  const { document } = parseHTML(`<html><head></head><body><form id="contact-form" action="/api/contact" data-language="en" data-sending="Sending" data-success="Success" data-unavailable="Unavailable" data-error="Error" data-verification="Verify" data-rate-limited="Wait" data-verifying="Verifying" data-verified-label="Verified" data-verified="Verified" data-retry-verification="Retry" data-verification-retry="Retry verification" data-verification-expired="Expired"><input name="name" value="Visitor"><input name="email" value="visitor@example.com"><select id="contact-topic" name="topic"><option value="visit">Visit</option></select><textarea id="contact-message" name="message">Sunday visit question</textarea><input name="website" value=""><button id="contact-verify" type="button">Verify</button><div id="contact-verification"></div><p id="contact-status">Verify</p><button type="submit" disabled>Send</button></form><span id="message-count"></span><span id="contact-context"></span><p class="contact-context" hidden></p><a data-lang href="https://pillarcbc.org/zh-hant/contact/">繁</a></body></html>`);
  const form = document.getElementById("contact-form");
  form.reportValidity = () => true;
  form.reset = () => { document.getElementById("contact-message").value = ""; };
  document.getElementById("contact-status").focus = () => {};
  let callbacks, posts = 0, resolves = [], renderCount = 0, removed = 0, requests = 0;
  const timers = new Map();
  let timerId = 0;
  const turnstile = { render: (_, options) => { callbacks = options; renderCount++; return renderCount; }, execute: () => {}, remove: () => { removed++; } };
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
  const verify = document.getElementById("contact-verify");
  return {
    document, form, status: document.getElementById("contact-status"), button: form.querySelector("[type=submit]"), verify,
    requests: () => requests, posts: () => posts, callbacks: () => callbacks, renders: () => renderCount, removed: () => removed,
    expire: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(f => f()); },
    start: async () => { verify.dispatchEvent(event("click")); await tick(); if (available && loadScript && document.querySelector("script")?.onload) { window.turnstile = turnstile; document.querySelector("script").onload(); await tick(); } },
    success: () => callbacks.callback("token"), finish: () => resolves.shift()(), submit: () => form.dispatchEvent(event("submit")),
  };
}
test("verification starts only on click and Send requires successful verification", async () => {
  const ui = await page();
  assert.equal(ui.requests(), 0);
  assert.equal(ui.button.disabled, true);
  ui.submit(); assert.equal(ui.posts(), 0);
  await ui.start();
  assert.equal(ui.status.textContent, "Verifying");
  assert.equal(ui.callbacks().execution, "execute");
  assert.equal(ui.callbacks().retry, "never");
  assert.equal(ui.button.disabled, true);
  ui.submit(); assert.equal(ui.posts(), 0);
  ui.success();
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.status.textContent, "Verified");
  ui.expire(); assert.equal(ui.button.disabled, false);
});
test("configuration failure offers a retry without losing fields", async () => {
  const ui = await page({}, false);
  await ui.start();
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.verify.disabled, false);
  assert.equal(ui.status.textContent, "Retry verification");
  assert.equal(ui.document.getElementById("contact-message").value, "Sunday visit question");
});
test("stalled script times out and can be retried without a reload", async () => {
  const ui = await page({}, true, false);
  await ui.start(); ui.expire();
  assert.equal(ui.status.textContent, "Retry verification");
  assert.equal(ui.verify.disabled, false);
  assert.equal(ui.button.disabled, true);
  await ui.start(); assert.equal(ui.status.textContent, "Verifying");
  assert.equal(ui.requests(), 2);
});
test("stalled challenge recovers and ignores late callbacks from the old attempt", async () => {
  const ui = await page();
  await ui.start(); const old = ui.callbacks();
  ui.expire();
  assert.equal(ui.removed(), 1);
  assert.equal(ui.button.disabled, true);
  await ui.start();
  old.callback("stale"); old["error-callback"]();
  assert.equal(ui.status.textContent, "Verifying");
  assert.equal(ui.button.disabled, true);
  ui.success(); assert.equal(ui.button.disabled, false);
});
test("errors, expiry, and interactive timeouts allow manual re-verification", async () => {
  for (const event of ["expired-callback", "timeout-callback", "error-callback"]) {
    const ui = await page(); await ui.start(); ui.success();
    ui.callbacks()[event]();
    assert.equal(ui.button.disabled, true);
    assert.equal(ui.verify.disabled, false);
    await ui.start(); ui.success(); assert.equal(ui.button.disabled, false);
  }
});
test("duplicate verify and send clicks are ignored; success cannot be sent twice", async () => {
  const ui = await page();
  await ui.start(); await ui.start(); assert.equal(ui.renders(), 1);
  ui.success(); ui.submit(); ui.submit();
  assert.equal(ui.posts(), 1); assert.equal(ui.button.disabled, true);
  assert.equal(ui.verify.disabled, true);
  ui.finish(); await tick();
  assert.equal(ui.status.textContent, "Success");
  assert.equal(ui.document.getElementById("contact-message").value, "");
  ui.submit(); assert.equal(ui.posts(), 1);
});
test("provider failures keep content and require fresh verification before retrying", async () => {
  for (const [code, text] of [["send_failed", "Error"], ["rate_limited", "Wait"], ["verification_failed", "Verify"]]) {
    const ui = await page({ code }); await ui.start(); ui.success();
    ui.submit(); ui.finish(); await tick();
    assert.equal(ui.status.textContent, text);
    assert.equal(ui.document.getElementById("contact-message").value, "Sunday visit question");
    assert.equal(ui.button.disabled, true); assert.equal(ui.verify.disabled, false);
    ui.submit(); assert.equal(ui.posts(), 1);
    await ui.start(); ui.success(); assert.equal(ui.button.disabled, false);
  }
});
