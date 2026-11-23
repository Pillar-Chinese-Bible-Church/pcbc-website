(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var button = form.querySelector("[type=submit]");
  var status = document.getElementById("contact-status");
  var sendLabel = button.textContent;
  var verify = document.getElementById("contact-verify");
  var widget;
  var token = "";
  var attempt = 0;
  var timer;
  var script;
  var controller;
  var busy = false;
  var checking = false;
  var sent = false;
  function show(text, error) {
    status.textContent = text;
    status.classList.toggle("contact-status-error", !!error);
  }
  function cancelVerification() {
    attempt++;
    checking = false;
    token = "";
    window.clearTimeout(timer);
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
  function retry(text, error) {
    cancelVerification();
    verify.disabled = busy || sent;
    verify.textContent = form.dataset.retryVerification;
    show(text, error);
  }
  verify.addEventListener("click", async function () {
    if (checking || busy || sent) return;
    cancelVerification();
    checking = true;
    var current = attempt;
    verify.disabled = true;
    verify.textContent = form.dataset.verifying;
    show(form.dataset.verifying);
    controller = new AbortController();
    // Bound both script loading and challenge execution. Late callbacks from a
    // timed-out attempt cannot unlock Send or overwrite a newer attempt.
    timer = window.setTimeout(function () {
      if (current === attempt) retry(form.dataset.verificationRetry, true);
    }, 15000);
    try {
      var api = window.turnstile ? Promise.resolve() : new Promise(function (resolve, reject) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      // Load configuration and the third-party API together, instead of serially.
      var results = await Promise.all([
        fetch(form.action, { headers: { Accept: "application/json" }, signal: controller.signal })
          .then(function (response) { if (!response.ok) throw new Error(); return response.json(); }),
        api,
      ]);
      if (current !== attempt) return;
      if (!results[0].siteKey || !window.turnstile) throw new Error();
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (current === attempt) retry(form.dataset.verificationRetry, true);
      }, 45000);
      widget = window.turnstile.render("#contact-verification", {
        sitekey: results[0].siteKey, action: "contact", execution: "execute", appearance: "execute",
        retry: "never", "refresh-expired": "manual", "refresh-timeout": "manual", size: "flexible",
        language: form.dataset.language === "zh-Hans" ? "zh-CN" : form.dataset.language === "zh-Hant" ? "zh-TW" : "en",
        callback: function (response) {
          if (current !== attempt || !checking || busy || sent) return;
          window.clearTimeout(timer);
          checking = false;
          if (!response) { retry(form.dataset.verificationRetry, true); return; }
          token = response;
          button.disabled = !token;
          verify.textContent = form.dataset.verifiedLabel;
          show(form.dataset.verified);
        },
        "expired-callback": function () { if (current === attempt && !busy && !sent) retry(form.dataset.verificationExpired, false); },
        "timeout-callback": function () { if (current === attempt && !busy && !sent) retry(form.dataset.verificationRetry, true); },
        "error-callback": function () {
          if (current === attempt && !busy && !sent) retry(form.dataset.verificationRetry, true);
          return true;
        },
      });
      window.turnstile.execute(widget);
    } catch (_) {
      if (current === attempt) retry(form.dataset.verificationRetry, true);
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (busy || sent || !form.reportValidity()) return;
    if (checking) return;
    if (!token) { show(form.dataset.verification, true); return; }
    var fields = new FormData(form);
    busy = true;
    button.disabled = true;
    verify.disabled = true;
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
      cancelVerification();
      verify.disabled = sent;
      verify.hidden = sent;
      verify.textContent = form.dataset.retryVerification;
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
