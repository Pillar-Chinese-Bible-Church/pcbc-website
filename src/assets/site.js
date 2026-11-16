(function () {
  // Phone menu
  var nav = document.getElementById("nav");
  var btn = document.getElementById("menuBtn");
  function setOpen(open) {
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? btn.dataset.open : btn.dataset.closed;
  }
  btn.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); btn.focus(); }
  });

  // A static deployment can outlive an event. Recheck on load, tab return and once a minute.
  function updateEvents() {
    var now = Date.now();
    document.querySelectorAll("[data-event-end]").forEach(function (item) {
      item.hidden = Date.parse(item.dataset.eventEnd) <= now;
    });
    document.querySelectorAll("[data-ended-notice]").forEach(function (notice) {
      notice.hidden = Date.parse(notice.dataset.endedNotice) > now;
    });
    var section = document.querySelector("[data-upcoming-events]");
    if (section) {
      var empty = !section.querySelector(".event-card:not([hidden])");
      section.hidden = empty;
      document.querySelectorAll("[data-events-nav]").forEach(function (link) { link.hidden = empty; });
    }
  }
  updateEvents();
  window.setInterval(updateEvents, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) updateEvents(); });

  // Remember the language someone picks, so lang.js leaves them on it next time
  document.querySelectorAll("[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("pcbc-lang", a.dataset.lang); } catch (e) {}
    });
  });
})();
