(function () {
  var button = document.querySelector("[data-copy-email]");
  if (!button) return;
  var label = button.textContent;
  var status = document.querySelector(".giving-copy-status");
  var reset;
  button.hidden = false;
  button.addEventListener("click", async function () {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail);
      button.textContent = button.dataset.copied;
      status.textContent = button.dataset.copied;
      reset = setTimeout(function () { button.textContent = label; status.textContent = ""; }, 4000);
    } catch (_) {
      status.textContent = button.dataset.copyFallback;
    }
  });
})();
