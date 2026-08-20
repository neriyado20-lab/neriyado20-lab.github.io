(() => {
  const targets = document.querySelectorAll("[data-hebrew-date]");
  if (!targets.length) return;

  const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const HUNDREDS = ["", "ק", "ר", "ש", "ת"];

  function punctuateHebrewNumber(value) {
    if (!value) return "";
    if (value.length === 1) return `${value}׳`;
    return `${value.slice(0, -1)}״${value.slice(-1)}`;
  }

  function hebrewNumber(number) {
    let value = Number.parseInt(String(number).replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(value) || value <= 0) return String(number || "");
    value %= 1000;
    let letters = "";
    while (value >= 400) {
      letters += "ת";
      value -= 400;
    }
    letters += HUNDREDS[Math.floor(value / 100)] || "";
    value %= 100;
    if (value === 15) return "ט״ו";
    if (value === 16) return "ט״ז";
    letters += TENS[Math.floor(value / 10)] || "";
    letters += ONES[value % 10] || "";
    return punctuateHebrewNumber(letters);
  }

  function hebrewYear(number) {
    const value = Number.parseInt(String(number).replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(value) || value <= 0) return String(number || "");
    const thousands = Math.floor(value / 1000);
    const rest = hebrewNumber(value % 1000);
    return `${ONES[thousands] || thousands}׳${rest}`;
  }

  const date = new Date();
  let text = "";

  try {
    const parts = new Intl.DateTimeFormat("he-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatToParts(date);
    const day = parts.find((part) => part.type === "day")?.value || "";
    const month = parts.find((part) => part.type === "month")?.value || "";
    const year = parts.find((part) => part.type === "year")?.value || "";
    text = `${hebrewNumber(day)} ב${month} ${hebrewYear(year)}`.trim();
  } catch {
    text = new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  targets.forEach((target) => {
    target.textContent = text;
  });
})();
