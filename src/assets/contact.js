(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var button = form.querySelector("[type=submit]");
  var status = document.getElementById("contact-status");
  var sendLabel = button.textContent;
  var widget;
  var busy = false;
  var sent = false;
  function show(text, error) {
    status.textContent = text;
    status.classList.toggle("contact-status-error", !!error);
  }
  function unavailable() { show(form.dataset.unavailable, true); button.disabled = true; }

  // Runtime configuration keeps secret values out of generated HTML and allows
  // preview and production to use separate Turnstile widgets and destinations.
  fetch(form.action, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) })
    .then(function (response) { if (!response.ok) throw new Error(); return response.json(); })
    .then(function (config) {
      if (!config.siteKey) throw new Error();
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onerror = unavailable;
      script.onload = function () {
        try {
          widget = window.turnstile.render("#contact-verification", {
            sitekey: config.siteKey, action: "contact", language: form.dataset.language === "zh-Hans" ? "zh-CN" : form.dataset.language === "zh-Hant" ? "zh-TW" : "en",
            callback: function () { if (!busy && !sent) { button.disabled = false; show(""); } },
            "expired-callback": function () { if (!busy && !sent) { button.disabled = true; show(form.dataset.verification); } },
            "error-callback": function () { if (!busy && !sent) { button.disabled = true; show(form.dataset.verification, true); } },
          });
          show(form.dataset.verification);
        } catch (_) { unavailable(); }
      };
      document.head.appendChild(script);
    }).catch(unavailable);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (busy || sent || !form.reportValidity()) return;
    var token = window.turnstile && window.turnstile.getResponse(widget);
    if (!token) { show(form.dataset.verification, true); return; }
    var fields = new FormData(form);
    busy = true;
    button.disabled = true;
    button.textContent = form.dataset.sending;
    form.setAttribute("aria-busy", "true");
    show(form.dataset.sending);
    try {
      var response = await fetch(form.action, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), topic: fields.get("topic"), message: fields.get("message"), website: fields.get("website"), regarding: context, language: form.dataset.language, token: token }),
        signal: AbortSignal.timeout(30000),
      });
      var result = await response.json();
      if (response.ok && result.code === "accepted") {
        sent = true;
        form.reset();
        document.getElementById("message-count").textContent = "0 / 4,000";
        show(form.dataset.success);
      } else {
        show(result.code === "rate_limited" ? form.dataset.rateLimited : result.code === "verification_failed" ? form.dataset.verification : form.dataset.error, true);
      }
    } catch (_) { show(form.dataset.error, true); }
    finally {
      busy = false;
      form.removeAttribute("aria-busy");
      button.textContent = sendLabel;
      // Keep fields on every failure. A fresh challenge is required before retrying.
      if (!sent && window.turnstile) window.turnstile.reset(widget);
      status.focus();
    }
  });
  var message = document.getElementById("contact-message");
  message.addEventListener("input", function () {
    document.getElementById("message-count").textContent = message.value.length.toLocaleString("en-US") + " / 4,000";
  });

  var params = new URLSearchParams(window.location.search);
  var topic = params.get("topic");
  var select = document.getElementById("contact-topic");
  if (Array.from(select.options).some(function (option) { return option.value === topic; })) select.value = topic;
  var context = (params.get("regarding") || "").slice(0, 160);
  if (context) {
    document.getElementById("contact-context").textContent = context;
    document.querySelector(".contact-context").hidden = false;
  }
  // Retain only inquiry context across language changes, never visitor-entered fields.
  document.querySelectorAll("[data-lang]").forEach(function (link) {
    var url = new URL(link.href);
    if (select.value) url.searchParams.set("topic", select.value);
    if (context) url.searchParams.set("regarding", context);
    link.href = url.href;
  });
})();
