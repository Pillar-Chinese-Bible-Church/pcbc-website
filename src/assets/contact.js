(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  // Presentation only: do not send, save, or log any visitor-entered content.
  // Keep this guard even though the sending button is disabled (e.g. implicit Enter submission).
  form.addEventListener("submit", function (event) { event.preventDefault(); });
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
