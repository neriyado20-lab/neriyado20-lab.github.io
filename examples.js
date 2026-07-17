(() => {
  const STORAGE_KEY = "gal-einai-seen-examples-v1";
  const VIEW_DELAY_MS = 4000;
  const SUPABASE_URL = "https://sxbfjouuguniegwbevwy.supabase.co";
  const SUPABASE_KEY = "sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK";
  const ADMIN_EMAIL = window.GAL_EINAI_ADMIN_AUTH?.supabaseAdminEmail || "admin@gal-einai.local";
  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const keepNewThisSession = new Set();
  const viewTimers = new Map();
  const contentById = new Map();
  let managerMode = false;

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

  function itemIdForCard(card) {
    return card.dataset.contentId || `static-${card.dataset.exampleId}`;
  }

  function titleForCard(card) {
    return card.querySelector("h2")?.textContent?.trim()
      || card.querySelector("strong")?.textContent?.trim()
      || "צופן";
  }

  function primaryUrlForCard(card) {
    const project = card.querySelector('a[href*="web.html?project="]')?.getAttribute("href") || "";
    const image = card.querySelector(".sample-image-link")?.getAttribute("href") || "";
    const first = card.querySelector(".track-view")?.getAttribute("href") || "";
    return project || image || first || location.href;
  }

  function shareUrlForCard(card) {
    return new URL(primaryUrlForCard(card), location.href).href;
  }

  function metadataForCard(card, next = {}) {
    const description = cleanDescription(next.description ?? card.querySelector("p")?.textContent ?? "");
    const topic = next.topic ?? card.dataset.topic ?? "users";
    const url = next.url ?? primaryUrlForCard(card);
    const absolute = absoluteUrl(url);
    const markers = [`[topic:${topic}]`];
    if (isJsonUrl(url) || String(url).includes("web.html?project=")) {
      markers.push(`[project:${absolute}]`);
    } else {
      markers.push(`[image:${absolute}]`);
    }
    return [markers.join("\n"), description].filter(Boolean).join("\n");
  }

  function payloadForCard(card, status, patch = {}) {
    const id = itemIdForCard(card);
    const existing = contentById.get(id) || {};
    const now = new Date().toISOString();
    return {
      id,
      type: "example",
      title: patch.title ?? existing.title ?? titleForCard(card),
      url: patch.url ?? existing.url ?? absoluteUrl(primaryUrlForCard(card)),
      status,
      description: patch.description ?? metadataForCard(card, patch),
      created_at: existing.created_at || existing.at || now,
      updated_at: now
    };
  }

  async function upsertContent(item) {
    if (!supabaseClient) throw new Error("החיבור לניהול אינו פעיל.");
    const { error } = await supabaseClient.from("admin_content").upsert(item);
    if (error) throw error;
    contentById.set(item.id, item);
  }

  async function deleteContent(id) {
    if (!supabaseClient) throw new Error("החיבור לניהול אינו פעיל.");
    const { error } = await supabaseClient.from("admin_content").delete().eq("id", id);
    if (error) throw error;
    contentById.delete(id);
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
    article.dataset.contentId = item.id || "";
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

  function rebuildCardActions(card, item, seen) {
    const actions = card.querySelector(".hero-actions");
    if (!actions) return;
    const url = absoluteUrl(item.url || primaryUrlForCard(card));
    const projectUrl = markerValue(item.description, "project") || (isJsonUrl(url) ? url : "");
    const imageUrl = markerValue(item.description, "image") || (!isJsonUrl(url) ? url : "");
    actions.replaceChildren();
    if (projectUrl) {
      const openProject = document.createElement("a");
      openProject.className = "button primary track-view";
      openProject.href = `web.html?project=${encodeURIComponent(projectUrl)}`;
      openProject.textContent = "פתח באתר";
      actions.appendChild(openProject);
    }
    if (imageUrl) {
      const openImage = document.createElement("a");
      openImage.className = "button primary track-view";
      openImage.href = imageUrl;
      openImage.target = "_blank";
      openImage.rel = "noopener";
      openImage.textContent = "פתח תמונה";
      actions.appendChild(openImage);
      const imageLink = card.querySelector(".sample-image-link");
      const img = imageLink?.querySelector("img");
      if (imageLink) imageLink.href = imageUrl;
      if (img) img.src = imageUrl;
    }
    if (url) {
      const openFile = document.createElement("a");
      openFile.className = "button secondary";
      openFile.href = url;
      openFile.target = "_blank";
      openFile.rel = "noopener";
      openFile.textContent = "פתח קובץ";
      actions.appendChild(openFile);
    }
    const mark = document.createElement("button");
    mark.className = "button secondary mark-unseen";
    mark.type = "button";
    mark.textContent = "סמן עוד לא ראיתי";
    mark.addEventListener("click", () => markUnseen(card, seen));
    actions.appendChild(mark);
  }

  function applyStaticOverride(item, seen) {
    if (!item.id || !String(item.id).startsWith("static-")) return;
    const exampleId = String(item.id).slice("static-".length);
    const card = document.querySelector(`[data-example-id="${CSS.escape(exampleId)}"]`);
    if (!card) return;
    card.dataset.contentId = item.id;
    if (item.status !== "active" && item.status !== "past_dates") {
      card.dataset.adminHidden = "true";
      card.hidden = true;
      return;
    }
    delete card.dataset.adminHidden;
    card.dataset.topic = topicFor(item);
    card.dataset.uploaded = String(item.updated_at || item.created_at || card.dataset.uploaded || new Date().toISOString()).slice(0, 10);
    const title = card.querySelector("h2");
    const description = card.querySelector("p");
    if (title && item.title) title.textContent = item.title;
    if (description) description.textContent = cleanDescription(item.description) || description.textContent;
    rebuildCardActions(card, item, seen);
    setCardState(card, seen);
  }

  async function loadPublishedContent(seen) {
    const layout = document.querySelector(".sample-layout");
    if (!layout) return;
    try {
      const params = new URLSearchParams({
        select: "id,type,title,url,status,description,created_at,updated_at",
        type: "eq.example",
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
      items.forEach((item) => contentById.set(item.id, item));
      items.filter((item) => String(item.id || "").startsWith("static-")).forEach((item) => applyStaticOverride(item, seen));
      items.forEach((item) => {
        if (String(item.id || "").startsWith("static-")) return;
        if (item.status !== "active" && item.status !== "past_dates") return;
        const id = `admin-${String(item.id || item.title).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
        if (document.querySelector(`[data-example-id="${CSS.escape(id)}"]`)) return;
        const card = cardForContent(item);
        layout.prepend(card);
        setCardState(card, seen);
        card.querySelector(".mark-unseen")?.addEventListener("click", () => markUnseen(card, seen));
      });
      updateVaultPicker();
      wireShareAndAdminTools(seen);
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

  function cardTitle(card) {
    return card.querySelector("h2")?.textContent?.trim()
      || card.querySelector("strong")?.textContent?.trim()
      || card.dataset.exampleId
      || "";
  }

  function updateVaultPicker() {
    const select = document.getElementById("cipherVaultSelect");
    if (!select) return;
    const currentValue = select.value;
    const cards = Array.from(document.querySelectorAll("[data-example-id]"))
      .filter((card) => card.dataset.adminHidden !== "true")
      .sort((a, b) => cardTitle(a).localeCompare(cardTitle(b), "he"));
    select.replaceChildren();
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "בחר צופן...";
    select.appendChild(first);
    cards.forEach((card) => {
      const id = card.dataset.exampleId;
      const title = cardTitle(card);
      if (!id || !title) return;
      const option = document.createElement("option");
      option.value = id;
      option.textContent = title;
      select.appendChild(option);
    });
    if (currentValue && select.querySelector(`option[value="${CSS.escape(currentValue)}"]`)) {
      select.value = currentValue;
    }
  }

  function focusVaultCard(id, seen) {
    if (!id) return;
    const card = document.querySelector(`[data-example-id="${CSS.escape(id)}"]`);
    if (!card) return;
    document.querySelectorAll("[data-example-filter]").forEach((item) => item.classList.remove("is-active"));
    document.querySelector('[data-example-filter="all"]')?.classList.add("is-active");
    document.querySelectorAll("[data-topic-filter]").forEach((item) => item.classList.remove("is-active"));
    document.querySelector('[data-topic-filter="all"]')?.classList.add("is-active");
    applyFilter(seen);
    card.hidden = false;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("vault-focus");
    window.setTimeout(() => card.classList.remove("vault-focus"), 1800);
  }

  function applyFilter(seen) {
    const filter = activeFilter();
    const topic = activeTopic();
    const cards = Array.from(document.querySelectorAll("[data-example-id]"))
      .filter((card) => card.dataset.adminHidden !== "true");
    const visibleCards = [];
    cards.forEach((card) => {
      if (card.dataset.adminHidden === "true") {
        card.hidden = true;
        return;
      }
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

  async function shareCard(card) {
    const title = titleForCard(card);
    const url = shareUrlForCard(card);
    const text = `${title} - גל עיני`;
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
    await navigator.clipboard?.writeText(url);
    alert("הקישור הועתק. אפשר להדביק אותו בכל מקום.");
  }

  function openShareMenu(card) {
    const title = encodeURIComponent(titleForCard(card));
    const url = encodeURIComponent(shareUrlForCard(card));
    const choice = window.prompt("שיתוף: כתוב 1 לווטסאפ, 2 למייל, 3 להעתקת קישור", "1");
    if (choice === "1") {
      window.open(`https://wa.me/?text=${title}%20${url}`, "_blank", "noopener");
    } else if (choice === "2") {
      location.href = `mailto:?subject=${title}&body=${url}`;
    } else {
      navigator.clipboard?.writeText(decodeURIComponent(url));
      alert("הקישור הועתק.");
    }
  }

  function ensureToolArea(card) {
    let area = card.querySelector(".cipher-card-tools");
    if (!area) {
      area = document.createElement("div");
      area.className = "cipher-card-tools";
      card.querySelector(".sample-copy")?.appendChild(area);
    }
    return area;
  }

  function addShareButton(card) {
    const area = ensureToolArea(card);
    if (area.querySelector("[data-share-cipher]")) return;
    const share = document.createElement("button");
    share.className = "button secondary";
    share.type = "button";
    share.dataset.shareCipher = "true";
    share.textContent = "שתף";
    share.addEventListener("click", async () => {
      try {
        await shareCard(card);
      } catch {
        openShareMenu(card);
      }
    });
    area.prepend(share);
  }

  function addAdminActions(card, seen) {
    if (!managerMode || card.querySelector(".cipher-admin-actions")) return;
    const area = document.createElement("div");
    area.className = "cipher-admin-actions";
    const action = (label, handler) => {
      const button = document.createElement("button");
      button.className = "button secondary";
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await handler();
        } catch (error) {
          alert(error.message || "הפעולה נכשלה.");
        } finally {
          button.disabled = false;
        }
      });
      return button;
    };
    const saveStatus = async (status) => {
      const item = payloadForCard(card, status);
      await upsertContent(item);
      if (status === "archive" || status === "draft") {
        card.dataset.adminHidden = "true";
        card.hidden = true;
      } else {
        delete card.dataset.adminHidden;
        card.dataset.topic = topicFor(item);
        card.hidden = false;
      }
      applyFilter(seen);
      updateVaultPicker();
    };
    area.append(
      action("פרסם", () => saveStatus("active")),
      action("תאריכי עבר", () => saveStatus("past_dates")),
      action("ארכיון", () => saveStatus("archive")),
      action("החלף קישור", async () => {
        const current = primaryUrlForCard(card);
        const url = window.prompt("הדבק קישור חדש לתמונה או לקובץ הצופן", current);
        if (!url) return;
        const title = window.prompt("שם הצופן", titleForCard(card)) || titleForCard(card);
        const item = payloadForCard(card, "active", { url: absoluteUrl(url), title });
        await upsertContent(item);
        alert("הקישור הוחלף. רענון הדף יציג את העדכון.");
      }),
      action("מחק", async () => {
        if (!window.confirm(`למחוק/להסתיר את "${titleForCard(card)}" מהאתר?`)) return;
        const id = itemIdForCard(card);
        if (id.startsWith("static-")) {
          await saveStatus("archive");
        } else {
          await deleteContent(id);
          card.remove();
          applyFilter(seen);
          updateVaultPicker();
        }
      })
    );
    ensureToolArea(card).appendChild(area);
  }

  function wireShareAndAdminTools(seen) {
    document.querySelectorAll("[data-example-id]").forEach((card) => {
      addShareButton(card);
      addAdminActions(card, seen);
    });
  }

  async function detectManagerMode(seen) {
    if (!supabaseClient) return;
    try {
      const { data } = await supabaseClient.auth.getSession();
      const email = data.session?.user?.email || "";
      managerMode = String(email).trim().toLowerCase() === String(ADMIN_EMAIL).trim().toLowerCase();
      document.getElementById("examplesManagerStrip").hidden = !managerMode;
      document.body.classList.toggle("manager-mode", managerMode);
      wireShareAndAdminTools(seen);
    } catch {
      managerMode = false;
    }
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
  document.getElementById("cipherVaultSelect")?.addEventListener("change", (event) => {
    focusVaultCard(event.target.value, seen);
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
  updateVaultPicker();
  wireShareAndAdminTools(seen);
  detectManagerMode(seen);
  wireSeenOnView(seen);
  loadPublishedContent(seen);
})();
