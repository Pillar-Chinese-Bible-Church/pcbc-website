const RECIPIENT = "info@pillarcbc.org";
const SENDER = "website@pillarcbc.org";
const TOPICS = { visit: "First visit", gatherings: "Groups and gatherings", events: "Events", beliefs: "Faith questions", giving: "Giving", other: "Other" };
const MAX_BYTES = 24000;

function reply(status, code, extra = {}) {
  return Response.json({ code, ...extra }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function configured(env) {
  return env.CONTACT_FORM_ENABLED === "true" && env.RESEND_API_KEY && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && env.CONTACT_ABUSE;
}
function allowedHost(hostname, env) {
  return (env.CONTACT_ALLOWED_HOSTNAMES || "pillarcbc.org,www.pillarcbc.org").split(",").map(s => s.trim()).includes(hostname);
}
async function readBody(request) {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new Error("too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

// No visitor fields, email credentials or provider error bodies are logged or persisted.
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!["GET", "POST"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  if (!configured(env) || !allowedHost(url.hostname, env)) return reply(503, "unavailable");
  if (request.method === "GET") return reply(200, "ready", { siteKey: env.TURNSTILE_SITE_KEY });
  if (request.headers.get("origin") !== url.origin) return reply(403, "forbidden");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reply(415, "invalid");

  let data;
  try { data = await readBody(request); } catch (error) { return reply(error.message === "too_large" ? 413 : 400, "invalid"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return reply(400, "invalid");
  const { name, email, topic, message, regarding = "", token, website = "", language = "en" } = data;
  if (typeof website !== "string" || website !== "") return reply(400, "invalid");
  if (typeof name !== "string" || !name.trim() || name.length > 120 || /[\r\n\x00-\x1f\x7f]/.test(name) ||
      typeof email !== "string" || email.length > 254 || !/^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/.test(email) ||
      typeof topic !== "string" || !Object.hasOwn(TOPICS, topic) ||
      typeof message !== "string" || message.trim().length < 10 || message.length > 4000 || message.includes("\0") ||
      typeof regarding !== "string" || regarding.length > 160 || /[\r\n\x00-\x1f\x7f]/.test(regarding) ||
      typeof token !== "string" || !token || token.length > 2048 ||
      !["en", "zh-Hans", "zh-Hant"].includes(language)) return reply(400, "invalid");

  try {
    // KV stores only a daily-salted IP hash and short-lived counters. It is a coarse
    // abuse guard, not a globally atomic quota; Turnstile is always required too.
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return reply(403, "forbidden");
    const day = new Date().toISOString().slice(0, 10);
    const key = "contact:" + await digest(`${env.TURNSTILE_SECRET_KEY}:${day}:${ip}`);
    const previous = await env.CONTACT_ABUSE.get(key, "json");
    const now = Date.now();
    const count = previous && now - previous.start < 60000 ? previous.count : 0;
    if (count >= 5) return reply(429, "rate_limited");
    await env.CONTACT_ABUSE.put(key, JSON.stringify({ start: count ? previous.start : now, count: count + 1 }), { expirationTtl: 120 });

    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10000),
    });
    if (!verification.ok) return reply(503, "unavailable");
    const challenge = await verification.json();
    if (!challenge.success || challenge.hostname !== url.hostname || challenge.action !== "contact") return reply(403, "verification_failed");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: SENDER, to: [RECIPIENT], reply_to: email,
        subject: `[Website contact] ${TOPICS[topic]}`,
        text: `Name: ${name.trim()}\nEmail: ${email}\nTopic: ${TOPICS[topic]}\nLanguage: ${language}\nRegarding: ${regarding || "—"}\n\n${message.trim()}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return reply(502, "send_failed");
    const result = await response.json();
    // A provider ID means accepted for delivery, not confirmed inbox arrival.
    if (typeof result.id !== "string" || !result.id.trim() || result.error || result.name) return reply(502, "send_failed");
    return reply(200, "accepted");
  } catch {
    // Do not retry a send automatically: the provider may have accepted a timed-out request.
    return reply(503, "unavailable");
  }
}
