(function () {
  var nav = document.getElementById("nav");
  var btn = document.getElementById("menuBtn");
  if (nav && btn) {
    // Enhance only after the handler exists: navigation remains usable without JavaScript.
    function setOpen(open) {
      nav.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? btn.dataset.open : btn.dataset.closed);
    }
    btn.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); btn.focus(); }
    });
    nav.classList.add("enhanced");
    btn.classList.add("enhanced");
  }

  var section = document.querySelector("[data-upcoming-events]");
  var track = document.getElementById("event-track");
  var controls = document.querySelector("[data-event-controls]");
  var previous = document.querySelector("[data-event-prev]");
  var next = document.querySelector("[data-event-next]");
  function updateCarousel() {
    if (!track || !controls) return;
    var overflow = track.scrollWidth > track.clientWidth + 2;
    controls.hidden = !overflow;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  function scrollEvents(direction) {
    track.scrollBy({ left: direction * track.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  if (track && controls) {
    previous.addEventListener("click", function () { scrollEvents(-1); });
    next.addEventListener("click", function () { scrollEvents(1); });
    track.addEventListener("scroll", updateCarousel, { passive: true });
    track.addEventListener("keydown", function (event) {
      if (event.target !== track) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); scrollEvents(event.key === "ArrowLeft" ? -1 : 1);
      }
    });
    window.addEventListener("resize", updateCarousel, { passive: true });
    window.addEventListener("load", updateCarousel, { once: true });
  }

  // All upcoming cards are present, so later events remain reachable as earlier ones expire.
  function updateEvents() {
    var now = Date.now();
    document.querySelectorAll("[data-event-end]").forEach(function (item) {
      item.hidden = Date.parse(item.dataset.eventEnd) <= now;
    });
    document.querySelectorAll("[data-ended-notice]").forEach(function (notice) {
      notice.hidden = Date.parse(notice.dataset.endedNotice) > now;
    });
    if (section) section.hidden = !section.querySelector(".event-card:not([hidden])");
    document.querySelectorAll("[data-events-nav]").forEach(function (link) {
      link.hidden = Date.parse(link.dataset.lastEventEnd) <= now;
    });
    updateCarousel();
  }
  if (document.querySelector("[data-event-end], [data-ended-notice], [data-events-nav]")) {
    updateEvents();
    window.setInterval(updateEvents, 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) updateEvents(); });
  }

  document.querySelectorAll("[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("pcbc-lang", a.dataset.lang); } catch (e) {}
    });
  });
})();
