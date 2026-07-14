(() => {
  const targets = document.querySelectorAll("[data-hebrew-date]");
  if (!targets.length) return;

  const date = new Date();
  let text = "";

  try {
    text = new Intl.DateTimeFormat("he-u-ca-hebrew", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    text = new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  targets.forEach((target) => {
    target.textContent = text;
  });
})();
