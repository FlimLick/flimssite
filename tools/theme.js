(() => {
  const theme = localStorage.getItem("flimsLabTheme") || "crimson";
  const body = document.body;
  if (!body) return;
  body.classList.remove("theme-ember", "theme-glacier", "theme-forest");
  if (theme !== "crimson") {
    body.classList.add(`theme-${theme}`);
  }
})();
