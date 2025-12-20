(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const body = document.body;

  const isSameOrigin = (href) => {
    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin;
    } catch (err) {
      return false;
    }
  };

  const isSamePageHash = (href) => {
    if (!href) return false;
    if (!href.startsWith("#")) return false;
    return true;
  };

  const handleNavigate = (event, link) => {
    const href = link.getAttribute("href");
    if (!href || isSamePageHash(href)) return;
    if (link.target && link.target !== "_self") return;
    if (!isSameOrigin(href)) return;
    if (prefersReduced) return;

    event.preventDefault();
    body.classList.remove("page-transition-in");
    body.classList.add("page-transition-out");

    window.setTimeout(() => {
      window.location.href = href;
    }, 200);
  };

  const setActiveNav = () => {
    const active = body.dataset.active;
    if (!active) return;
    const activeLink = document.querySelector(`[data-nav="${active}"]`);
    if (activeLink) activeLink.classList.add("is-active");
  };

  const injectHeader = async () => {
    const mount = document.querySelector("#site-header");
    if (!mount) return;

    try {
      const response = await fetch("/partials/header.html", { cache: "no-cache" });
      if (!response.ok) return;
      mount.innerHTML = await response.text();
      setActiveNav();
    } catch (err) {
      return;
    }
  };

  const injectFooter = async () => {
    const mount = document.querySelector("#site-footer");
    if (!mount) return;

    try {
      const response = await fetch("/partials/footer.html", { cache: "no-cache" });
      if (!response.ok) return;
      mount.innerHTML = await response.text();
    } catch (err) {
      return;
    }
  };

  const showContactConfirmation = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("submitted") !== "true") return;
    const banner = document.querySelector("[data-confirmation]");
    if (!banner) return;
    banner.hidden = false;
  };

  const bindContactForm = () => {
    const form = document.querySelector("#contact-form");
    if (!form) return;
    const banner = document.querySelector("[data-confirmation]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type=\"submit\"]");
      if (submitButton) submitButton.disabled = true;

      try {
        const formData = new FormData(form);
        const response = await fetch(form.action, {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Form submit failed");
        if (banner) banner.hidden = false;
        form.reset();
      } catch (err) {
        if (banner) {
          banner.textContent = "Something went wrong. Please try again.";
          banner.hidden = false;
        }
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    handleNavigate(event, link);
  });

  injectHeader();
  injectFooter();
  showContactConfirmation();
  bindContactForm();
})();
