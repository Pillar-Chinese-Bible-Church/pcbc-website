import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";
const tick = () => new Promise(resolve => setImmediate(resolve));
async function page(result = { code: "accepted" }, available = true) {
  const { document } = parseHTML(`<html><head></head><body><form id="contact-form" action="/api/contact" data-language="en" data-sending="Sending" data-success="Success" data-unavailable="Unavailable" data-error="Error" data-verification="Verify" data-rate-limited="Wait"><input name="name" value="Visitor"><input name="email" value="visitor@example.com"><select id="contact-topic" name="topic"><option value="visit">Visit</option></select><textarea id="contact-message" name="message">Sunday visit question</textarea><input name="website" value=""><div id="contact-verification"></div><p id="contact-status"></p><button type="submit" disabled>Send</button></form><span id="message-count"></span><span id="contact-context"></span><p class="contact-context" hidden></p><a data-lang href="https://pillarcbc.org/zh-hant/contact/">繁</a></body></html>`);
  const form = document.getElementById("contact-form");
  form.reportValidity = () => true;
  form.reset = () => { document.getElementById("contact-message").value = ""; };
  document.getElementById("contact-status").focus = () => {};
  let callbacks;
  let posts = 0;
  let resolvePost;
  const turnstile = { render: (selector, options) => { callbacks = options; return 1; }, getResponse: () => "token", reset: () => {} };
  vm.runInNewContext(fs.readFileSync("src/assets/contact.js", "utf8"), {
    document, URL, URLSearchParams, AbortSignal,
    window: { location: { search: "?topic=visit&regarding=Sunday" }, turnstile },
    FormData: class { get(key) { return form.querySelector(`[name="${key}"]`).value; } },
    fetch: async (_, options) => {
      if (!options.method) return { ok: available, json: async () => ({ siteKey: "public" }) };
      posts++;
      return new Promise(resolve => { resolvePost = () => resolve({ ok: result.code === "accepted", json: async () => result }); });
    },
  });
  await tick();
  if (available) { document.querySelector("script").onload(); callbacks.callback(); }
  return { document, form, status: document.getElementById("contact-status"), button: form.querySelector("button"), posts: () => posts, finish: () => resolvePost(), submit: () => form.dispatchEvent(new document.defaultView.Event("submit", { cancelable: true })) };
}
test("button remains unavailable without configured endpoint", async () => {
  const ui = await page({}, false);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.status.textContent, "Unavailable");
  assert.equal(ui.posts(), 0);
});
test("duplicate clicks are ignored during sending and after accepted success", async () => {
  const ui = await page();
  assert.equal(ui.button.disabled, false);
  ui.submit(); ui.submit();
  assert.equal(ui.posts(), 1);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.status.textContent, "Sending");
  ui.finish(); await tick();
  assert.equal(ui.status.textContent, "Success");
  assert.equal(ui.document.getElementById("contact-message").value, "");
  ui.submit();
  assert.equal(ui.posts(), 1);
});
test("provider failure and rate limits keep message content and never display success", async () => {
  for (const [code, text] of [["send_failed", "Error"], ["rate_limited", "Wait"], ["verification_failed", "Verify"]]) {
    const ui = await page({ code });
    ui.submit(); ui.finish(); await tick();
    assert.equal(ui.status.textContent, text);
    assert.equal(ui.document.getElementById("contact-message").value, "Sunday visit question");
    assert.equal(ui.button.disabled, true);
  }
});
