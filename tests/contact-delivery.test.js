import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/contact.js";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const recipient = "info@pillarcbc.org";
const payload = { name: "Visitor", email: "visitor@example.com", topic: "visit", message: "I would like to visit on Sunday.", token: "challenge", language: "en" };
function setup(overrides = {}) {
  const store = new Map();
  return { CONTACT_FORM_ENABLED: "true", RESEND_API_KEY: "private-token", TURNSTILE_SITE_KEY: "public-sitekey", TURNSTILE_SECRET_KEY: "private-secret", CONTACT_ABUSE: { get: async key => store.has(key) ? JSON.parse(store.get(key)) : null, put: async (key, value) => { store.set(key, value); } }, ...overrides };
}
function request(data = payload, headers = {}) {
  return new Request("https://pillarcbc.org/api/contact", { method: "POST", headers: { Origin: "https://pillarcbc.org", "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...headers }, body: JSON.stringify(data) });
}
function mockNetwork(t, { challenge = {}, email = {}, emailStatus = 200, failure = false } = {}) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    if (failure) throw new Error("provider includes sensitive content");
    if (url.includes("siteverify")) return Response.json({ success: true, hostname: "pillarcbc.org", action: "contact", ...challenge });
    return Response.json({ id: "test-resend-message-id", ...email }, { status: emailStatus });
  });
  return calls;
}
test("unconfigured endpoint fails closed; public config contains only sitekey", async t => {
  const calls = mockNetwork(t);
  const response = await onRequest({ request: request(), env: setup({ CONTACT_FORM_ENABLED: "false" }) });
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
  const config = await onRequest({ request: new Request("https://pillarcbc.org/api/contact"), env: setup() });
  assert.deepEqual(await config.json(), { code: "ready", siteKey: "public-sitekey" });
  assert.equal(config.headers.get("cache-control"), "no-store");
});
test("verified submissions use fixed recipient and sender, with visitor as Reply-To", async t => {
  const calls = mockNetwork(t);
  const response = await onRequest({ request: request({ ...payload, to: "attacker@example.com", from: "attacker@example.com" }), env: setup() });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).code, "accepted");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://api.resend.com/emails");
  assert.equal(calls[1].options.headers.Authorization, "Bearer private-token");
  assert.deepEqual(calls[1].body.to, [recipient]);
  assert.equal(calls[1].body.from, "website@pillarcbc.org");
  assert.equal(calls[1].body.reply_to, payload.email);
  assert.match(calls[1].body.text, /I would like to visit/);
  assert.equal(calls[1].body.html, undefined);
});
test("rejects bad input, large bodies, cross-origin requests and unapproved hosts", async t => {
  const calls = mockNetwork(t);
  for (const data of [null, [], { ...payload, name: "name\r\nBcc: bad" }, { ...payload, email: "a@example.com\nBcc:b@example.com" }, { ...payload, topic: "constructor" }, { ...payload, message: "short" }, { ...payload, token: "" }, { ...payload, website: "bot" }, { ...payload, regarding: "x".repeat(161) }]) {
    assert.equal((await onRequest({ request: request(data), env: setup() })).status, 400);
  }
  assert.equal((await onRequest({ request: request({ ...payload, message: "x".repeat(25000) }), env: setup() })).status, 413);
  assert.equal((await onRequest({ request: request(payload, { Origin: "https://other.example" }), env: setup() })).status, 403);
  assert.equal((await onRequest({ request: new Request("https://branch.pillarcbc.pages.dev/api/contact"), env: setup() })).status, 503);
  assert.equal(calls.length, 0);
});
test("wrong-host, invalid and wrong-action challenges cannot send email", async t => {
  for (const challenge of [{ success: false }, { hostname: "other.example" }, { action: "other" }]) {
    const calls = mockNetwork(t, { challenge });
    assert.equal((await onRequest({ request: request(), env: setup() })).status, 403);
    assert.equal(calls.length, 1);
    t.mock.restoreAll();
  }
});
test("provider rejection, malformed responses and network failure never report success or leak content", async t => {
  for (const options of [{ emailStatus: 401 }, { emailStatus: 429 }, { email: { id: undefined } }, { email: { id: "" } }, { email: { name: "validation_error", message: "private provider detail" } }, { failure: true }]) {
    const calls = mockNetwork(t, options);
    const response = await onRequest({ request: request(), env: setup() });
    assert.ok(response.status >= 500);
    assert.doesNotMatch(await response.text(), /private|sensitive|visitor/);
    assert.ok(calls.length <= 2);
    t.mock.restoreAll();
  }
});
test("throttle stores short-lived counters without visitor content or raw IP", async t => {
  const calls = mockNetwork(t);
  const env = setup();
  const writes = [];
  const original = env.CONTACT_ABUSE.put;
  env.CONTACT_ABUSE.put = async (key, value, options) => { writes.push({ key, value, options }); return original(key, value); };
  for (let i = 0; i < 5; i++) assert.equal((await onRequest({ request: request(), env })).status, 200);
  assert.equal((await onRequest({ request: request(), env })).status, 429);
  assert.equal(calls.length, 10);
  assert.doesNotMatch(JSON.stringify(writes), /192\.0\.2|Visitor|visitor@example|Sunday|challenge/);
  assert.ok(writes.every(write => write.options.expirationTtl === 120));
});
