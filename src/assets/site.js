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

  // Remember the language someone picks, so lang.js leaves them on it next time
  document.querySelectorAll("[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("pcbc-lang", a.dataset.lang); } catch (e) {}
    });
  });
})();
