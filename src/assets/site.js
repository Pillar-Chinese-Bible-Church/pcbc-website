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
    var sectionLinks = nav.querySelectorAll("[data-nav-section]");
    if (sectionLinks.length) {
      function updateCurrentSection() {
        sectionLinks.forEach(function (link) {
          var id = link.dataset.navSection;
          if (window.location.hash === "#" + id && document.getElementById(id)) {
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      }
      updateCurrentSection();
      window.addEventListener("hashchange", updateCurrentSection);
    }
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

  var viewer = document.getElementById("photo-viewer");
  var photos = Array.from(document.querySelectorAll("[data-photo-strip] .photo-open"));
  if (viewer && typeof viewer.showModal === "function" && photos.length) {
    var activePhoto = 0;
    var opener;
    var stage = viewer.querySelector("[data-photo-stage]");
    var count = viewer.querySelector("[data-photo-count]");
    var touchStart;
    function showPhoto(index) {
      activePhoto = (index + photos.length) % photos.length;
      var thumbnail = photos[activePhoto].querySelector("img");
      // Reuse the build's optimized sources, including its larger responsive sizes.
      var photo = (thumbnail.closest("picture") || thumbnail).cloneNode(true);
      var image = photo.matches("img") ? photo : photo.querySelector("img");
      image.sizes = "100vw";
      image.loading = "eager";
      photo.querySelectorAll("source").forEach(function (source) { source.sizes = "100vw"; });
      stage.replaceChildren(photo);
      count.textContent = (activePhoto + 1) + " / " + photos.length;
    }
    photos.forEach(function (button, index) {
      button.disabled = false;
      button.addEventListener("click", function () {
        opener = button;
        showPhoto(index);
        viewer.showModal();
        document.documentElement.classList.add("photo-viewer-open");
      });
    });
    viewer.querySelector("[data-photo-close]").addEventListener("click", function () { viewer.close(); });
    viewer.querySelector("[data-photo-prev]").addEventListener("click", function () { showPhoto(activePhoto - 1); });
    viewer.querySelector("[data-photo-next]").addEventListener("click", function () { showPhoto(activePhoto + 1); });
    viewer.querySelectorAll("[data-photo-prev], [data-photo-next]").forEach(function (button) { button.hidden = photos.length < 2; });
    viewer.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        showPhoto(activePhoto + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });
    viewer.addEventListener("click", function (event) { if (event.target === viewer) viewer.close(); });
    stage.addEventListener("touchstart", function (event) {
      touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    stage.addEventListener("touchend", function (event) {
      if (!touchStart || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - touchStart.x;
      var dy = event.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(activePhoto + (dx < 0 ? 1 : -1));
      touchStart = null;
    }, { passive: true });
    stage.addEventListener("touchcancel", function () { touchStart = null; });
    viewer.addEventListener("close", function () {
      document.documentElement.classList.remove("photo-viewer-open");
      stage.replaceChildren();
      touchStart = null;
      if (opener) opener.focus({ preventScroll: true });
    });
  }

  document.querySelectorAll("[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("pcbc-lang", a.dataset.lang); } catch (e) {}
    });
  });
})();
