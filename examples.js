(() => {
  const STORAGE_KEY = "gal-einai-seen-examples-v1";
  const VIEW_DELAY_MS = 4000;
  const SUPABASE_URL = "https://sxbfjouuguniegwbevwy.supabase.co";
  const SUPABASE_KEY = "sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK";
  const keepNewThisSession = new Set();
  const viewTimers = new Map();

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
    if (!id || keepNewThisSession.has(id)) return;
    seen[id] = card.dataset.uploaded || new Date().toISOString().slice(0, 10);
    writeSeen(seen);
    setCardState(card, seen);
    applyFilter(seen);
  }

  function markOpened(card, seen) {
    const id = card.dataset.exampleId;
    if (!id) return;
    keepNewThisSession.delete(id);
    markSeen(card, seen);
  }

  function markUnseen(card, seen) {
    const id = card.dataset.exampleId;
    if (!id) return;
    keepNewThisSession.add(id);
    window.clearTimeout(viewTimers.get(id));
    viewTimers.delete(id);
    delete seen[id];
    writeSeen(seen);
    setCardState(card, seen);
    applyFilter(seen);
  }

  function scheduleSeen(card, seen) {
    const id = card.dataset.exampleId;
    if (!id || keepNewThisSession.has(id) || isSeen(card, seen) || viewTimers.has(id)) return;
    viewTimers.set(id, window.setTimeout(() => {
      viewTimers.delete(id);
      markSeen(card, seen);
    }, VIEW_DELAY_MS));
  }

  function cancelScheduledSeen(card) {
    const id = card.dataset.exampleId;
    if (!id) return;
    window.clearTimeout(viewTimers.get(id));
    viewTimers.delete(id);
  }

  function hasMeaningfulVisibility(card) {
    if (!card || card.hidden) return false;
    const rect = card.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    if (visibleWidth <= 0 || visibleHeight <= 0) return false;
    const visibleArea = visibleWidth * visibleHeight;
    const totalArea = rect.width * rect.height;
    return visibleArea / totalArea >= 0.25;
  }

  function scanVisibleCards(seen) {
    document.querySelectorAll("[data-example-id]").forEach((card) => {
      if (hasMeaningfulVisibility(card)) {
        scheduleSeen(card, seen);
      } else {
        cancelScheduledSeen(card);
      }
    });
  }

  function wireSeenOnView(seen) {
    const cards = Array.from(document.querySelectorAll("[data-example-id]"));
    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => scheduleSeen(card, seen));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25 && !card.hidden) {
          scheduleSeen(card, seen);
        } else {
          cancelScheduledSeen(card);
        }
      });
    }, { threshold: [0, 0.25, 0.55, 0.85] });
    cards.forEach((card) => {
      if (card.dataset.viewObserverWired === "true") return;
      card.dataset.viewObserverWired = "true";
      observer.observe(card);
    });
    scanVisibleCards(seen);
    if (document.documentElement.dataset.exampleViewEventsWired !== "true") {
      document.documentElement.dataset.exampleViewEventsWired = "true";
      let scanQueued = false;
      const queueScan = () => {
        if (scanQueued) return;
        scanQueued = true;
        window.requestAnimationFrame(() => {
          scanQueued = false;
          scanVisibleCards(seen);
        });
      };
      window.addEventListener("scroll", queueScan, { passive: true });
      window.addEventListener("resize", queueScan);
      window.addEventListener("focus", queueScan);
    }
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

  function markerValue(text, name) {
    const match = String(text || "").match(new RegExp(`\\[${name}:([^\\]]+)\\]`));
    return match ? match[1].trim() : "";
  }

  function cleanDescription(text) {
    return String(text || "").replace(/\[(topic|image|project):[^\]]+\]/g, "").trim();
  }

  function topicFor(item) {
    if (item.status === "past_dates") return "past_dates";
    return markerValue(item.description, "topic") || "users";
  }

  function isJsonUrl(url) {
    return /\.json($|\?)/i.test(String(url || ""));
  }

  function absoluteUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return url;
    }
  }

  function cardForContent(item) {
    const id = `admin-${String(item.id || item.title).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
    const url = absoluteUrl(item.url || "");
    const projectUrl = markerValue(item.description, "project") || (isJsonUrl(url) ? url : "");
    const imageUrl = markerValue(item.description, "image") || (!isJsonUrl(url) ? url : "");
    const article = document.createElement("article");
    article.className = "sample-card";
    article.dataset.exampleId = id;
    article.dataset.uploaded = String(item.updated_at || item.created_at || new Date().toISOString()).slice(0, 10);
    article.dataset.topic = topicFor(item);
    const date = item.updated_at || item.created_at ? new Date(item.updated_at || item.created_at).toLocaleDateString("he-IL") : "";
    const description = cleanDescription(item.description) || "צופן שפורסם מממשק הניהול.";
    article.innerHTML = `
      <div class="sample-copy">
        <div class="sample-meta">
          <span class="eyebrow">${item.status === "past_dates" ? "מאגר תאריכי עבר" : "צפני משתמשים"}</span>
          ${date ? `<span class="upload-date">הועלה: ${date}</span>` : ""}
          <span class="new-badge" hidden>חדש</span>
        </div>
        <h2></h2>
        <p></p>
        <div class="hero-actions">
          ${projectUrl ? `<a class="button primary track-view" href="web.html?project=${encodeURIComponent(projectUrl)}">פתח באתר</a>` : ""}
          ${imageUrl ? `<a class="button primary track-view" href="${imageUrl}" target="_blank" rel="noopener">פתח תמונה</a>` : ""}
          ${url ? `<a class="button secondary" href="${url}" target="_blank" rel="noopener">פתח קובץ</a>` : ""}
          <button class="button secondary mark-unseen" type="button">סמן עוד לא ראיתי</button>
        </div>
      </div>
      ${imageUrl ? `<a class="sample-image-link track-view" href="${imageUrl}" target="_blank" rel="noopener"><img src="${imageUrl}" alt=""></a>` : ""}
    `;
    article.querySelector("h2").textContent = item.title || "צופן שפורסם";
    article.querySelector("p").textContent = description;
    const img = article.querySelector("img");
    if (img) img.alt = `צילום מסך של ${item.title || "צופן"} מתוך גל עיני`;
    return article;
  }

  async function loadPublishedContent(seen) {
    const layout = document.querySelector(".sample-layout");
    if (!layout) return;
    try {
      const params = new URLSearchParams({
        select: "id,type,title,url,status,description,created_at,updated_at",
        type: "eq.example",
        status: "in.(active,past_dates)",
        order: "updated_at.desc"
      });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_content?${params}`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      if (!response.ok) return;
      const items = await response.json();
      if (!Array.isArray(items) || !items.length) return;
      items.forEach((item) => {
        const id = `admin-${String(item.id || item.title).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
        if (document.querySelector(`[data-example-id="${CSS.escape(id)}"]`)) return;
        const card = cardForContent(item);
        layout.prepend(card);
        setCardState(card, seen);
      });
      window.GalEinaiWireSampleCards?.();
      wireSeenOnView(seen);
      applyFilter(seen);
    } catch {
      // Static examples remain available when the live list cannot be loaded.
    }
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

  function scrollToTopicResult(visibleCards) {
    const topic = activeTopic();
    const empty = document.getElementById("examplesEmptyState");
    const target = visibleCards[0] || (topic === "users" ? document.getElementById("user-ciphers") : empty);
    if (empty) empty.hidden = Boolean(visibleCards.length);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyFilter(seen) {
    const filter = activeFilter();
    const topic = activeTopic();
    const cards = Array.from(document.querySelectorAll("[data-example-id]"));
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
    const empty = document.getElementById("examplesEmptyState");
    if (empty) empty.hidden = Boolean(visibleCards.length) || topic === "all" || topic === "users";
    updateCounter(cards, visibleCards);
    return visibleCards;
  }

  const seen = readSeen();
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.(".track-view");
    if (!link) return;
    const card = link.closest("[data-example-id]") || (link.matches("[data-example-id]") ? link : null);
    if (card) markOpened(card, seen);
  }, true);
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
      const visibleCards = applyFilter(seen);
      scrollToTopicResult(visibleCards);
    });
  });
  document.querySelectorAll("[data-example-id]").forEach((card) => {
    setCardState(card, seen);
    const trackedLinks = card.matches(".track-view") ? [card] : Array.from(card.querySelectorAll(".track-view"));
    trackedLinks.forEach((link) => {
      link.addEventListener("click", () => markOpened(card, seen));
    });
    const markButton = card.querySelector(".mark-unseen");
    if (markButton) {
      markButton.addEventListener("click", () => markUnseen(card, seen));
    }
  });
  applyFilter(seen);
  wireSeenOnView(seen);
  loadPublishedContent(seen);
})();
