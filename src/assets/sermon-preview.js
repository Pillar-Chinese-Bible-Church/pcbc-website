// Rendered only on feature-preview builds; the real collection is never changed.
(() => {
  const controls = document.querySelector("[data-sermon-preview-controls]");
  const picker = controls?.querySelector("[data-sermon-preview-state]");
  if (!picker) return;
  const options = [...picker.querySelectorAll("option")];
  function visit(option) {
    if (!option) return;
    const target = new URL(option.value, location.href);
    if (target.origin !== location.origin) return;
    location.replace(target.pathname + target.search + target.hash);
  }
  const forced = new URLSearchParams(location.search).get("sermon_state");
  if (forced) visit(options.find(option => option.dataset.state === forced));
  picker.addEventListener("change", () => visit(options.find(option => option.value === picker.value)));
})();
