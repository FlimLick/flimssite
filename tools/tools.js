document.addEventListener("DOMContentLoaded", () => {
  const TRANSITION_OUT_MS = 200;

  // play entry animation
  document.body.classList.add("page-transition-in");
  setTimeout(() => document.body.classList.remove("page-transition-in"), 320);

  function shouldBlock(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
  }

  function bindNav(el, href) {
    if (!el) return;
    el.addEventListener("click", (e) => {
      if (shouldBlock(e)) return;
      e.preventDefault();
      const target = href || el.getAttribute("data-nav") || el.getAttribute("href");
      if (!target) return;
      document.body.classList.add("page-transition-out");
      setTimeout(() => { window.location.href = target; }, TRANSITION_OUT_MS);
    });
  }

  document.querySelectorAll(".tool-link, .back-btn, [data-nav]").forEach((el) => {
    bindNav(el);
  });

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
