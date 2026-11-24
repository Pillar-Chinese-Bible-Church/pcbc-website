(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var button = form.querySelector("[type=submit]");
  var status = document.getElementById("contact-status");
  var sendLabel = button.textContent;
  var retryButton = document.getElementById("contact-retry");
  var widget;
  var token = "";
  var attempt = 0;
  var loadTimer;
  var script;
  var controller;
  var busy = false;
  var sent = false;
  function show(text, error) {
    status.textContent = text;
    status.classList.toggle("contact-status-error", !!error);
  }
  function cleanup() {
    attempt++;
    token = "";
    window.clearTimeout(loadTimer);
    if (controller) controller.abort();
    if (script) {
      script.onload = script.onerror = null;
      script.remove();
      script = undefined;
    }
    if (widget !== undefined && window.turnstile) {
      window.turnstile.remove(widget);
      widget = undefined;
    }
    button.disabled = true;
  }
  async function initialize(preserveStatus) {
    if (busy || sent) return;
    cleanup();
    var current = attempt;
    retryButton.hidden = true;
    if (!preserveStatus) show(form.dataset.loading);
    controller = new AbortController();
    function failed() {
      if (current !== attempt || busy || sent) return;
      cleanup();
      retryButton.hidden = false;
      show(form.dataset.verificationRetry, true);
    }
    // Only bound resource loading. Once rendered, let the native widget manage
    // its own challenge timing, checkbox, retries, and token refresh.
    loadTimer = window.setTimeout(failed, 15000);
    try {
      var api = window.turnstile ? Promise.resolve() : new Promise(function (resolve, reject) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      var results = await Promise.all([
        fetch(form.action, { headers: { Accept: "application/json" }, signal: controller.signal })
          .then(function (response) { if (!response.ok) throw new Error(); return response.json(); }),
        api,
      ]);
      if (current !== attempt) return;
      if (!results[0].siteKey || !window.turnstile) throw new Error();
      window.clearTimeout(loadTimer);
      if (!preserveStatus) show(form.dataset.verification);
      widget = window.turnstile.render("#contact-verification", {
        sitekey: results[0].siteKey, action: "contact", theme: "light", size: "flexible",
        execution: "render", appearance: "always", retry: "auto",
        "refresh-expired": "auto", "refresh-timeout": "auto",
        language: form.dataset.language === "zh-Hans" ? "zh-cn" : form.dataset.language === "zh-Hant" ? "zh-tw" : "en",
        callback: function (response) {
          if (current !== attempt || busy || sent || !response) return;
          token = response;
          button.disabled = false;
          retryButton.hidden = true;
          show(form.dataset.verified);
        },
        "before-interactive-callback": function () {
          if (current === attempt && !busy && !sent) show(form.dataset.verification);
        },
        "expired-callback": function () {
          if (current !== attempt || busy || sent) return;
          token = "";
          button.disabled = true;
          show(form.dataset.verificationExpired);
        },
        "timeout-callback": function () {
          if (current !== attempt || busy || sent) return;
          token = "";
          button.disabled = true;
          show(form.dataset.verification);
        },
        "error-callback": function () {
          if (current !== attempt || busy || sent) return;
          token = "";
          button.disabled = true;
          retryButton.hidden = false;
          show(form.dataset.verificationRetry, true);
        },
      });
    } catch (_) { failed(); }
  }
  retryButton.addEventListener("click", function () { initialize(false); });
  // Prepare the standard Cloudflare widget early, while the visitor fills in
  // their message, instead of downloading and constructing it on a button click.
  initialize(false);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (busy || sent || !form.reportValidity()) return;
    if (!token) { show(form.dataset.verification, true); return; }
    var fields = new FormData(form);
    busy = true;
    button.disabled = true;
    retryButton.hidden = true;
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
      cleanup();
      if (!sent) initialize(true);
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
