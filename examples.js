(() => {
  const STORAGE_KEY = "gal-einai-seen-examples-v1";

  function readSeen() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeSeen(seen) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    } catch {
      // The page still works when storage is blocked; only the "new" memory is unavailable.
    }
  }

  function isSeen(card, seen) {
    const id = card.dataset.exampleId;
    const uploaded = card.dataset.uploaded || "";
    return Boolean(id && seen[id] === uploaded);
  }

  function setCardState(card, seen) {
    const badge = card.querySelector(".new-badge");
    const markButton = card.querySelector(".mark-unseen");
    const seenNow = isSeen(card, seen);
    card.classList.toggle("is-new", !seenNow);
    if (badge) badge.hidden = seenNow;
    if (markButton) markButton.hidden = !seenNow;
  }

  function markSeen(card, seen) {
    const id = card.dataset.exampleId;
    if (!id) return;
    seen[id] = card.dataset.uploaded || new Date().toISOString().slice(0, 10);
    writeSeen(seen);
    setCardState(card, seen);
  }

  function markUnseen(card, seen) {
    const id = card.dataset.exampleId;
    if (!id) return;
    delete seen[id];
    writeSeen(seen);
    setCardState(card, seen);
  }

  const seen = readSeen();
  document.querySelectorAll(".sample-card[data-example-id]").forEach((card) => {
    setCardState(card, seen);
    card.querySelectorAll(".track-view").forEach((link) => {
      link.addEventListener("click", () => markSeen(card, seen));
    });
    const markButton = card.querySelector(".mark-unseen");
    if (markButton) {
      markButton.addEventListener("click", () => markUnseen(card, seen));
    }
  });
})();
