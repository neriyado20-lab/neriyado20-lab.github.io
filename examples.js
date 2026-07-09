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
    card.classList.toggle("is-seen", seenNow);
    if (badge) badge.hidden = seenNow;
    if (markButton) markButton.hidden = !seenNow;
  }

  function markSeen(card, seen) {
    const id = card.dataset.exampleId;
    if (!id) return;
    seen[id] = card.dataset.uploaded || new Date().toISOString().slice(0, 10);
    writeSeen(seen);
    setCardState(card, seen);
    applyFilter(seen);
  }

  function markUnseen(card, seen) {
    const id = card.dataset.exampleId;
    if (!id) return;
    delete seen[id];
    writeSeen(seen);
    setCardState(card, seen);
    applyFilter(seen);
  }

  function activeFilter() {
    return document.querySelector("[data-example-filter].is-active")?.dataset.exampleFilter || "all";
  }

  function activeTopic() {
    return document.querySelector("[data-topic-filter].is-active")?.dataset.topicFilter || "all";
  }

  function activeTopicLabel() {
    return document.querySelector("[data-topic-filter].is-active")?.textContent?.trim() || "כל הנושאים";
  }

  function updateCounter(cards, visibleCards) {
    const counter = document.getElementById("examplesCount");
    if (!counter) return;
    const total = cards.length;
    const visible = visibleCards.length;
    const newCount = cards.filter((card) => card.classList.contains("is-new")).length;
    const topic = activeTopic();
    const topicText = topic === "all" ? "" : ` | נושא: ${activeTopicLabel()}`;
    counter.textContent = `מוצגים ${visible} מתוך ${total} צפנים | חדשים: ${newCount}${topicText}`;
  }

  function applyFilter(seen) {
    const filter = activeFilter();
    const topic = activeTopic();
    const cards = Array.from(document.querySelectorAll(".sample-card[data-example-id]"));
    const visibleCards = [];
    cards.forEach((card) => {
      setCardState(card, seen);
      const seenNow = isSeen(card, seen);
      const showBySeen = filter === "all" || (filter === "new" && !seenNow) || (filter === "seen" && seenNow);
      const showByTopic = topic === "all" || card.dataset.topic === topic;
      const show = showBySeen && showByTopic;
      card.hidden = !show;
      if (show) visibleCards.push(card);
    });
    document.querySelectorAll("[data-user-ciphers-empty]").forEach((section) => {
      section.hidden = topic !== "users";
    });
    updateCounter(cards, visibleCards);
  }

  const seen = readSeen();
  document.querySelectorAll("[data-example-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-example-filter]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      applyFilter(seen);
    });
  });
  document.querySelectorAll("[data-topic-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-topic-filter]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      applyFilter(seen);
      if (button.dataset.topicFilter === "users") {
        document.getElementById("user-ciphers")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
  document.querySelectorAll("[data-example-id]").forEach((card) => {
    setCardState(card, seen);
    const trackedLinks = card.matches(".track-view") ? [card] : Array.from(card.querySelectorAll(".track-view"));
    trackedLinks.forEach((link) => {
      link.addEventListener("click", () => markSeen(card, seen));
    });
    const markButton = card.querySelector(".mark-unseen");
    if (markButton) {
      markButton.addEventListener("click", () => markUnseen(card, seen));
    }
  });
  applyFilter(seen);
})();
