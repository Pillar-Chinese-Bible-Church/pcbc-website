// No iframe or YouTube player request until the visitor chooses Play.
for (const container of document.querySelectorAll("[data-sermon-video]")) {
  const button = container.querySelector("[data-video-load]");
  const id = container.dataset.videoId;
  if (!button || !/^[A-Za-z0-9_-]{11}$/.test(id || "")) continue;
  button.hidden = false;
  button.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
    frame.title = container.dataset.videoTitle;
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    container.replaceChildren(frame);
    frame.focus();
  }, { once: true });
}
