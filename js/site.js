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

  const applyActiveNav = () => {
    setActiveNav();
  };

  const initSettingsMenu = () => {
    const wrap = document.querySelector(".settings-wrap");
    if (!wrap) return;
    const toggle = wrap.querySelector(".settings-toggle");
    const menu = wrap.querySelector(".settings-menu");
    const checkbox = wrap.querySelector("#sound-toggle");
    const themeSelect = wrap.querySelector("#theme-select");
    if (!toggle || !menu || !checkbox) return;

    const storageKey = "flimsLabSound";
    const themeKey = "flimsLabTheme";
    const stored = localStorage.getItem(storageKey);
    checkbox.checked = stored === "true";
    if (themeSelect) {
      const storedTheme = localStorage.getItem(themeKey) || "crimson";
      themeSelect.value = storedTheme;
      document.body.classList.remove("theme-ember", "theme-glacier", "theme-forest", "theme-graphite");
      if (storedTheme !== "crimson") {
        document.body.classList.add(`theme-${storedTheme}`);
      }
    }

    const setExpanded = (value) => {
      wrap.classList.toggle("is-open", value);
      toggle.setAttribute("aria-expanded", value ? "true" : "false");
    };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setExpanded(!wrap.classList.contains("is-open"));
    });

    document.addEventListener("click", () => setExpanded(false));
    menu.addEventListener("click", (event) => event.stopPropagation());

    checkbox.addEventListener("change", () => {
      localStorage.setItem(storageKey, checkbox.checked ? "true" : "false");
    });

    if (themeSelect) {
      themeSelect.addEventListener("change", () => {
        const value = themeSelect.value;
        localStorage.setItem(themeKey, value);
        document.body.classList.remove("theme-ember", "theme-glacier", "theme-forest", "theme-graphite");
        if (value !== "crimson") {
          document.body.classList.add(`theme-${value}`);
        }
      });
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

  const initUiSounds = () => {
    const hoverSound = new Audio("/audio/hover.wav");
    const clickSound = new Audio("/audio/click.wav");
    hoverSound.preload = "auto";
    clickSound.preload = "auto";
    hoverSound.volume = 1.0;
    clickSound.volume = 1.0;

    let activated = false;
    let lastHover = null;
    let soundEnabled = localStorage.getItem("flimsLabSound") === "true";

    const unlockAudio = () => {
      if (activated) return;
      activated = true;
      hoverSound.load();
      clickSound.load();
      hoverSound.play().then(() => {
        hoverSound.pause();
        hoverSound.currentTime = 0;
      }).catch(() => {});
      clickSound.play().then(() => {
        clickSound.pause();
        clickSound.currentTime = 0;
      }).catch(() => {});
    };

    const isClickable = (el) => {
      if (!el) return false;
      if (el.matches("button:disabled, input:disabled")) return false;
      return el.matches(
        "a, button, .nav-link, .project-link, .social-link, .footer-link, .image-grid img, [role=\"button\"], [tabindex], input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"]"
      );
    };

    const playSound = (audio) => {
      if (!soundEnabled) return;
      audio.playbackRate = 0.92 + Math.random() * 0.16;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    };

    const playHover = (target) => {
      if (!activated || !target || target === lastHover) return;
      lastHover = target;
      playSound(hoverSound);
    };

    const playClick = () => {
      unlockAudio();
      playSound(clickSound);
    };

    document.addEventListener(
      "pointerdown",
      () => {
        unlockAudio();
        soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      },
      { once: true, capture: true }
    );

    document.addEventListener(
      "keydown",
      () => {
        unlockAudio();
        soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      },
      { once: true, capture: true }
    );

    document.addEventListener(
      "touchstart",
      () => {
        unlockAudio();
        soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      },
      { once: true, capture: true }
    );

    document.addEventListener(
      "pointerover",
      (event) => {
        if (event.pointerType && event.pointerType !== "mouse") return;
        const target = event.target.closest(
          "a, button, .nav-link, .project-link, .social-link, .footer-link, [role=\"button\"], input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"]"
        );
        if (!isClickable(target)) return;
        playHover(target);
      },
      true
    );

    document.addEventListener(
      "mouseover",
      (event) => {
        const target = event.target.closest(
          "a, button, .nav-link, .project-link, .social-link, .footer-link, .image-grid img, [role=\"button\"], [tabindex], input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"]"
        );
        if (!isClickable(target)) return;
        playHover(target);
      },
      true
    );

    document.addEventListener(
      "focusin",
      (event) => {
        unlockAudio();
        const target = event.target.closest(
          "a, button, .nav-link, .project-link, .social-link, .footer-link, .image-grid img, [role=\"button\"], [tabindex], input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"]"
        );
        if (!isClickable(target)) return;
        playHover(target);
      },
      true
    );

    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target.closest(
          "a, button, .nav-link, .project-link, .social-link, .footer-link, [role=\"button\"], input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"]"
        );
        if (!isClickable(target)) return;
        playClick();
      },
      true
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target.closest(
          "a, button, .nav-link, .project-link, .social-link, .footer-link, [role=\"button\"], input[type=\"button\"], input[type=\"submit\"], input[type=\"reset\"]"
        );
        if (!isClickable(target)) return;
        playClick();
      },
      true
    );
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    handleNavigate(event, link);
  });

  applyActiveNav();
  initSettingsMenu();
  showContactConfirmation();
  bindContactForm();
  initUiSounds();
})();
