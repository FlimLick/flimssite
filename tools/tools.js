document.addEventListener("DOMContentLoaded", () => {
  const TRANSITION_OUT_MS = 200;
  const hoverSound = new Audio("/audio/hover.wav");
  const clickSound = new Audio("/audio/click.wav");
  hoverSound.preload = "auto";
  clickSound.preload = "auto";
  hoverSound.volume = 1.0;
  clickSound.volume = 1.0;
  let activated = false;
  let lastHover = null;
  let soundEnabled = localStorage.getItem("flimsLabSound") === "true";

  // play entry animation
  document.body.classList.add("page-transition-in");
  setTimeout(() => document.body.classList.remove("page-transition-in"), 320);

  function shouldBlock(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
  }

  function unlockAudio() {
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
  }

  function playSound(audio) {
    audio.playbackRate = 0.92 + Math.random() * 0.16;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function playSound(audio) {
    if (!soundEnabled) return;
    audio.playbackRate = 0.92 + Math.random() * 0.16;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function bindNav(el, href) {
    if (!el) return;
    el.addEventListener("click", (e) => {
      if (shouldBlock(e)) return;
      e.preventDefault();
      const target = href || el.getAttribute("data-nav") || el.getAttribute("href");
      if (!target) return;
      unlockAudio();
      soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      playSound(clickSound);
      document.body.classList.add("page-transition-out");
      setTimeout(() => { window.location.href = target; }, TRANSITION_OUT_MS);
    });
  }

  document.querySelectorAll(".tool-link, .back-btn, [data-nav]").forEach((el) => {
    bindNav(el);
  });

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
      const target = event.target.closest(".tool-link, .back-btn, [data-nav], button, a");
      if (!target || target === lastHover) return;
      lastHover = target;
      if (!activated) return;
      soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      playSound(hoverSound);
    },
    true
  );

  document.addEventListener(
    "mouseover",
    (event) => {
      const target = event.target.closest(".tool-link, .back-btn, [data-nav], button, a");
      if (!target || target === lastHover) return;
      lastHover = target;
      if (!activated) return;
      soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      playSound(hoverSound);
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target.closest(".tool-link, .back-btn, [data-nav], button, a");
      if (!target) return;
      unlockAudio();
      soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      playSound(clickSound);
    },
    true
  );

  document.addEventListener(
    "focusin",
    (event) => {
      unlockAudio();
      const target = event.target.closest(".tool-link, .back-btn, [data-nav], button, a");
      if (!target || target === lastHover) return;
      lastHover = target;
      soundEnabled = localStorage.getItem("flimsLabSound") === "true";
      playSound(hoverSound);
    },
    true
  );

  // add "New" pill based on creation date
  const now = Date.now();
  const THREE_WEEKS = 21 * 24 * 60 * 60 * 1000;
  document.querySelectorAll(".tool-card[data-created]").forEach((card) => {
    const createdStr = card.getAttribute("data-created");
    const createdDate = createdStr ? new Date(createdStr) : null;
    if (!createdDate || isNaN(createdDate)) return;
    if (now - createdDate.getTime() <= THREE_WEEKS) {
      const tagRow = card.querySelector(".tool-tags") || card;
      const newPill = document.createElement("span");
      newPill.className = "pill new-pill";
      newPill.textContent = "New";
      tagRow.appendChild(newPill);
    }
  });
});
