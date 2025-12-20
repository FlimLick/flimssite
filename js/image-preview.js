(() => {
  const images = document.querySelectorAll(".image-grid img");
  if (!images.length) return;

  const overlay = document.createElement("div");
  overlay.className = "image-preview-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");

  const closeButton = document.createElement("button");
  closeButton.className = "image-preview-close";
  closeButton.type = "button";
  closeButton.textContent = "Close";

  const modal = document.createElement("div");
  modal.className = "image-preview-modal";

  const modalImage = document.createElement("img");
  modalImage.alt = "";

  const caption = document.createElement("div");
  caption.className = "image-preview-caption";

  modal.appendChild(modalImage);
  modal.appendChild(caption);
  overlay.appendChild(closeButton);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let lastFocus = null;

  const closePreview = () => {
    overlay.classList.remove("is-active");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("preview-open");
    document.body.classList.remove("preview-open");
    if (lastFocus) lastFocus.focus();
  };

  const openPreview = (img) => {
    lastFocus = img;
    modalImage.src = img.currentSrc || img.src;
    modalImage.alt = img.alt || "";
    caption.textContent = img.alt || "";
    overlay.classList.add("is-active");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("preview-open");
    document.body.classList.add("preview-open");
    closeButton.focus();
  };

  images.forEach((img) => {
    img.setAttribute("tabindex", "0");
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", "Open image preview");

    img.addEventListener("click", () => openPreview(img));
    img.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPreview(img);
      }
    });
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePreview();
  });

  closeButton.addEventListener("click", closePreview);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("is-active")) {
      closePreview();
    }
  });
})();
