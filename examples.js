(() => {
  const STORAGE_KEY = "gal-einai-seen-examples-v1";
  const ARCHIVED_CONTENT_KEY = "gal-einai-archived-content-v1";
  const ARCHIVED_STATIC_IDS_KEY = "gal-einai-archived-static-ciphers-v1";
  const FEEDBACK_KEY = "gal-einai-cipher-feedback-v1";
  const MANAGER_SESSION_KEY = "gal-einai-vault-manager-session-v1";
  const MANAGER_PASSWORD_HASH = "b2085a238dba1a766cd2de60089abeb61631cc4ac122d0363e6d67ad56605242";
  const VIEW_DELAY_MS = 1200;
  const SEEN_VISIBILITY_RATIO = 0.35;
  const SUPABASE_URL = "https://sxbfjouuguniegwbevwy.supabase.co";
  const SUPABASE_KEY = "sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK";
  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  const keepNewThisSession = new Set();
  const viewTimers = new Map();
  const contentById = new Map();
  let remoteContentLoaded = false;
  let managerMode = false;
  let publicPreviewMode = false;

  function effectiveManagerMode() {
    return managerMode && !publicPreviewMode;
  }

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function readManagerSession() {
    try {
      const raw = sessionStorage.getItem(MANAGER_SESSION_KEY) || localStorage.getItem(MANAGER_SESSION_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.ok === true && parsed?.hash === MANAGER_PASSWORD_HASH;
    } catch {
      return false;
    }
  }

  function writeManagerSession() {
    const payload = JSON.stringify({ ok: true, hash: MANAGER_PASSWORD_HASH, at: new Date().toISOString() });
    try {
      sessionStorage.setItem(MANAGER_SESSION_KEY, payload);
      localStorage.setItem(MANAGER_SESSION_KEY, payload);
    } catch {
      // If storage is blocked, manager mode remains active only until refresh.
    }
  }

  function clearManagerSession() {
    try {
      sessionStorage.removeItem(MANAGER_SESSION_KEY);
      localStorage.removeItem(MANAGER_SESSION_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  function openManagerLogin(seen) {
    if (managerMode) {
      updateManagerPreviewControls(seen);
      return;
    }
    const password = document.getElementById("vaultManagerPassword");
    const status = document.getElementById("vaultManagerLoginStatus");
    if (password) password.value = "";
    if (status) status.textContent = "";
    showDialog(document.getElementById("vaultManagerLogin"));
    window.setTimeout(() => password?.focus(), 50);
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function enableManagerMode(seen) {
    managerMode = true;
    publicPreviewMode = false;
    updateManagerPreviewControls(seen);
    applyFilter(seen);
    updateVaultPicker();
  }

  function disableManagerMode(seen) {
    managerMode = false;
    publicPreviewMode = false;
    clearManagerSession();
    updateManagerPreviewControls(seen);
    applyFilter(seen);
    updateVaultPicker();
  }

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

  function readFeedback() {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeFeedback(feedback) {
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
    } catch {
      // Feedback is a private convenience feature; the vault works without it.
    }
  }

  async function submitCipherFeedback(id, title, rating, comment) {
    if (!supabaseClient || (!rating && !comment)) return;
    await supabaseClient.from("site_submissions").insert({
      kind: "note",
      payload: {
        type: "cipher_feedback",
        cipherId: id,
        title,
        rating,
        text: comment,
        page: location.href
      }
    });
  }

  function clampRating(value) {
    const rating = Number(value) || 0;
    return Math.max(0, Math.min(5, Math.round(rating)));
  }

  function addCipherFeedback(card) {
    const id = card?.dataset?.exampleId;
    if (!id || card.querySelector(".cipher-feedback")) return;
    const feedback = readFeedback();
    const saved = feedback[id] || {};
    let currentRating = clampRating(saved.rating);
    const savedComment = String(saved.comment || "");
    const panel = document.createElement("section");
    panel.className = "cipher-feedback";
    panel.setAttribute("aria-label", "דירוג ותגובה לצופן");

    const title = document.createElement("strong");
    title.textContent = "דירוג ותגובה";

    const stars = document.createElement("div");
    stars.className = "cipher-rating";
    stars.setAttribute("role", "radiogroup");
    stars.setAttribute("aria-label", "דירוג הצופן");

    const status = document.createElement("small");
    status.className = "cipher-feedback-status";
    status.setAttribute("aria-live", "polite");

    const setRatingView = (rating) => {
      stars.querySelectorAll("button").forEach((button) => {
        const value = Number(button.dataset.rating) || 0;
        button.classList.toggle("is-active", value <= rating);
        button.setAttribute("aria-checked", String(value === rating));
      });
    };

    for (let value = 1; value <= 5; value += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.rating = String(value);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", `דירוג ${value} מתוך 5`);
      button.textContent = "★";
      button.addEventListener("click", () => {
        const current = readFeedback();
        current[id] = {
          ...(current[id] || {}),
          rating: value,
          updatedAt: new Date().toISOString()
        };
        writeFeedback(current);
        currentRating = value;
        setRatingView(value);
        status.textContent = "הדירוג נשמר במכשיר זה.";
        submitCipherFeedback(id, titleForCard(card), currentRating, comment.value.trim()).catch(() => {
          status.textContent = "הדירוג נשמר במכשיר זה. שליחה למנהל לא הושלמה.";
        });
      });
      stars.appendChild(button);
    }

    const comment = document.createElement("textarea");
    comment.rows = 2;
    comment.maxLength = 500;
    comment.placeholder = "תגובה אישית על הצופן";
    comment.value = savedComment;
    comment.addEventListener("input", () => {
      const current = readFeedback();
      const text = comment.value.trim();
      if (text || current[id]?.rating) {
        current[id] = {
          ...(current[id] || {}),
          comment: text,
          updatedAt: new Date().toISOString()
        };
      } else {
        delete current[id];
      }
      writeFeedback(current);
      status.textContent = "התגובה נשמרה במכשיר זה.";
    });

    const send = document.createElement("button");
    send.className = "button secondary";
    send.type = "button";
    send.textContent = "שלח תגובה למנהל";
    send.addEventListener("click", async () => {
      send.disabled = true;
      try {
        await submitCipherFeedback(id, titleForCard(card), currentRating, comment.value.trim());
        status.textContent = "התגובה נשלחה למנהל.";
      } catch {
        status.textContent = "התגובה נשמרה במכשיר זה. השליחה למנהל לא הושלמה.";
      } finally {
        send.disabled = false;
      }
    });

    setRatingView(currentRating);
    panel.append(title, stars, comment, send, status);
    card.querySelector(".sample-copy")?.appendChild(panel);
  }

  function wireCipherFeedback() {
    document.querySelectorAll("[data-example-id]").forEach(addCipherFeedback);
  }

  function readLocalArchivedContent() {
    try {
      const raw = localStorage.getItem(ARCHIVED_CONTENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocalArchivedContent(items) {
    try {
      localStorage.setItem(ARCHIVED_CONTENT_KEY, JSON.stringify(items.slice(-300)));
    } catch {
      // Archive actions still try the remote save; local persistence is only a manager-side fallback.
    }
  }

  function readArchivedStaticIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARCHIVED_STATIC_IDS_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function writeArchivedStaticIds(ids) {
    try {
      localStorage.setItem(ARCHIVED_STATIC_IDS_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      // Full archive records are still kept separately.
    }
  }

  function staticIdForItem(item) {
    const id = String(item?.id || "");
    return id.startsWith("static-") ? id : "";
  }

  function rememberArchivedStaticId(item) {
    const id = staticIdForItem(item);
    if (!id) return;
    const ids = readArchivedStaticIds();
    ids.add(id);
    writeArchivedStaticIds(ids);
  }

  function forgetArchivedStaticId(item) {
    const id = staticIdForItem(item);
    if (!id) return;
    const ids = readArchivedStaticIds();
    ids.delete(id);
    writeArchivedStaticIds(ids);
  }

  function contentIdentityKeys(item) {
    const keys = new Set();
    if (!item) return keys;
    if (item.id) keys.add(`id:${String(item.id).trim().toLowerCase()}`);
    if (item.title) keys.add(`title:${String(item.title).trim().toLowerCase()}`);
    [item.url, markerValue(item.description, "image"), markerValue(item.description, "project")]
      .filter(Boolean)
      .forEach((url) => {
        const absolute = absoluteUrl(String(url).trim());
        keys.add(`url:${absolute.toLowerCase()}`);
        const fileName = absolute.split(/[?#]/)[0].split("/").pop();
        if (fileName) keys.add(`file:${fileName.toLowerCase()}`);
      });
    return keys;
  }

  function hasSharedIdentity(a, b) {
    const aKeys = contentIdentityKeys(a);
    for (const key of contentIdentityKeys(b)) {
      if (aKeys.has(key)) return true;
    }
    return false;
  }

  function rememberLocalArchive(item) {
    if (!item?.id) return;
    const items = readLocalArchivedContent().filter((candidate) => (
      candidate.id !== item.id && !hasSharedIdentity(candidate, item)
    ));
    writeLocalArchivedContent([...items, { ...item, type: item.type || "example" }]);
    rememberArchivedStaticId(item);
  }

  function forgetLocalArchive(item) {
    if (!item?.id) return;
    writeLocalArchivedContent(readLocalArchivedContent().filter((candidate) => (
      candidate.id !== item.id && !hasSharedIdentity(candidate, item)
    )));
    forgetArchivedStaticId(item);
  }

  function isArchivedStatus(item) {
    return item?.status === "archive" || item?.status === "draft";
  }

  function rememberContentItem(item) {
    if (!item?.id) return;
    const existing = contentById.get(item.id);
    if (isArchivedStatus(existing) && !isArchivedStatus(item)) return;
    if (existing && isArchivedStatus(item)) {
      contentById.set(item.id, { ...existing, ...item });
      return;
    }
    contentById.set(item.id, item);
  }

  function archivedIdentityKeys() {
    const keys = new Set();
    [...contentById.values(), ...readLocalArchivedContent()]
      .filter((item) => item?.type === "example" || !item?.type)
      .filter((item) => item?.status === "archive" || item?.status === "draft")
      .forEach((item) => contentIdentityKeys(item).forEach((key) => keys.add(key)));
    return keys;
  }

  function hasArchivedIdentity(item) {
    const staticId = staticIdForItem(item);
    if (staticId && readArchivedStaticIds().has(staticId)) return true;
    const archived = archivedIdentityKeys();
    for (const key of contentIdentityKeys(item)) {
      if (archived.has(key)) return true;
    }
    return false;
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
      if (hasMeaningfulVisibility(card)) markSeen(card, seen);
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
    const availableArea = Math.min(rect.width, window.innerWidth) * Math.min(rect.height, window.innerHeight);
    return visibleArea >= availableArea * SEEN_VISIBILITY_RATIO;
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
        if (entry.isIntersecting && hasMeaningfulVisibility(card)) {
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
    return String(text || "").replace(/\[(topic|image|project|expire|vault):[^\]]+\]/g, "").trim();
  }

  function topicFor(item) {
    if (item.status === "past_dates") return "past_dates";
    return markerValue(item.description, "topic") || "events";
  }

  function topicLabel(topic) {
    return {
      dates: "תאריכים",
      geula: "גאולה ומשיח",
      events: "אירועים ואומות",
      healing: "רפואה וסגולות",
      past_dates: "תאריכי עבר",
      users: "צפני משתמשים"
    }[topic] || "אירועים ואומות";
  }

  function isExpiredContent(item) {
    if (!item || item.type !== "example") return false;
    if (item.status !== "active" && item.status !== "past_dates") return false;
    const expire = markerValue(item.description, "expire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(`${expire}T00:00:00`);
    return Number.isFinite(limit.getTime()) && limit < today;
  }

  async function archiveExpiredContent(items) {
    const expired = items.filter(isExpiredContent);
    if (!expired.length || !supabaseClient) return;
    try {
      const { data } = await supabaseClient.auth.getSession();
      const email = data.session?.user?.email || "";
      if (String(email).trim().toLowerCase() !== String(ADMIN_EMAIL).trim().toLowerCase()) return;
      const now = new Date().toISOString();
      await Promise.all(expired.map((item) => upsertContent({
        id: item.id,
        type: item.type,
        title: item.title,
        url: item.url,
        status: "archive",
        description: item.description,
        created_at: item.created_at,
        updated_at: now
      }).catch(() => null)));
    } catch {
      // Public visitors cannot archive; expired items are still hidden from the public list.
    }
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
    const topic = next.topic ?? card.dataset.topic ?? "events";
    const url = next.url ?? primaryUrlForCard(card);
    const absolute = absoluteUrl(url);
    const markers = ["[vault:v2]", `[topic:${topic}]`];
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
    rememberContentItem(item);
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
          <span class="eyebrow">${topicLabel(topicFor(item))}</span>
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
    if (readArchivedStaticIds().has(String(item.id)) || item.status !== "active" && item.status !== "past_dates" || isExpiredContent(item)) {
      card.dataset.adminHidden = "true";
      card.hidden = true;
      cancelScheduledSeen(card);
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

  function hideArchivedCards(item, sourceCard, seen) {
    const cards = new Set();
    if (sourceCard) cards.add(sourceCard);
    if (item.id) {
      document.querySelectorAll(`[data-content-id="${CSS.escape(String(item.id))}"]`).forEach((card) => cards.add(card));
      if (String(item.id).startsWith("static-")) {
        const exampleId = String(item.id).slice("static-".length);
        document.querySelectorAll(`[data-example-id="${CSS.escape(exampleId)}"]`).forEach((card) => cards.add(card));
      }
    }
    const targetUrl = absoluteUrl(item.url || "");
    if (targetUrl) {
      document.querySelectorAll("[data-example-id]").forEach((card) => {
        if (absoluteUrl(primaryUrlForCard(card)) === targetUrl) cards.add(card);
      });
    }
    cards.forEach((card) => {
      if (!card) return;
      if (item.id) card.dataset.contentId = item.id;
      card.dataset.adminHidden = "true";
      card.hidden = true;
      cancelScheduledSeen(card);
      card.remove();
    });
    applyFilter(seen);
    updateVaultPicker();
  }

  function hideUnpublishedStaticCards(activeStaticIds, seen) {
    if (!remoteContentLoaded) return;
    document.querySelectorAll("[data-example-id]").forEach((card) => {
      const staticId = `static-${card.dataset.exampleId || ""}`;
      if (!activeStaticIds.has(staticId)) {
        card.dataset.adminHidden = "true";
        card.hidden = true;
        cancelScheduledSeen(card);
      }
    });
    applyFilter(seen);
    updateVaultPicker();
  }

  function hideStaticCardsUntilContentLoads(seen) {
    document.querySelectorAll("[data-example-id]").forEach((card) => {
      const staticId = `static-${card.dataset.exampleId || ""}`;
      if (!staticId.startsWith("static-")) return;
      card.dataset.adminHidden = "true";
      card.hidden = true;
      cancelScheduledSeen(card);
    });
    applyLocalArchivedContent(seen);
    applyFilter(seen);
    updateVaultPicker();
  }

  function archivedItems() {
    return Array.from(contentById.values())
      .filter((item) => item.type === "example" && (item.status === "archive" || item.status === "draft"))
      .sort((a, b) => String(b.updated_at || b.updatedAt || "").localeCompare(String(a.updated_at || a.updatedAt || "")));
  }

  function archiveDetailFor(item) {
    const dateValue = item.updated_at || item.updatedAt || item.created_at || item.at || "";
    const date = dateValue ? new Date(dateValue).toLocaleDateString("he-IL") : "";
    const topic = topicFor(item);
    const label = topicLabel(topic);
    return [label, date ? `עודכן: ${date}` : "", item.url || ""].filter(Boolean).join(" | ");
  }

  function updateCardAfterManagerStatus(item, seen) {
    if (String(item.id || "").startsWith("static-")) {
      applyStaticOverride(item, seen);
      return;
    }
    const id = `admin-${String(item.id || item.title).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
    const existingCard = document.querySelector(`[data-example-id="${CSS.escape(id)}"]`);
    if (item.status === "archive" || item.status === "draft") {
      hideArchivedCards(item, existingCard, seen);
      return;
    }
    if (existingCard) {
      if (item.id) existingCard.dataset.contentId = item.id;
      delete existingCard.dataset.adminHidden;
      existingCard.dataset.topic = topicFor(item);
      existingCard.dataset.uploaded = String(item.updated_at || item.updatedAt || item.created_at || item.at || existingCard.dataset.uploaded || new Date().toISOString()).slice(0, 10);
      existingCard.hidden = false;
      rebuildCardActions(existingCard, item, seen);
      setCardState(existingCard, seen);
      return;
    }
    const layout = document.querySelector(".sample-layout");
    if (!layout) return;
    const card = cardForContent(item);
    layout.prepend(card);
    setCardState(card, seen);
    addCipherFeedback(card);
    card.querySelector(".mark-unseen")?.addEventListener("click", () => markUnseen(card, seen));
  }

  function applyLocalArchivedContent(seen) {
    readArchivedStaticIds().forEach((staticId) => {
      const exampleId = String(staticId).slice("static-".length);
      const card = document.querySelector(`[data-example-id="${CSS.escape(exampleId)}"]`);
      if (!card) return;
      card.dataset.contentId = staticId;
      card.dataset.adminHidden = "true";
      card.hidden = true;
      cancelScheduledSeen(card);
    });
    readLocalArchivedContent().forEach((item) => {
      if (!item?.id) return;
      const archived = {
        ...item,
        status: item.status === "draft" ? "draft" : "archive",
        type: item.type || "example"
      };
      rememberContentItem(archived);
      if (String(archived.id).startsWith("static-")) {
        applyStaticOverride(archived, seen);
      } else {
        updateCardAfterManagerStatus(archived, seen);
      }
    });
    renderManagerArchive(seen);
    applyFilter(seen);
    updateVaultPicker();
  }

  function effectiveContentItem(item) {
    if (!item?.id) return item;
    const current = contentById.get(item.id);
    if (!current) return item;
    if (isArchivedStatus(current)) {
      return current;
    }
    if (hasArchivedIdentity(item)) return { ...current, status: "archive" };
    return { ...item, ...current };
  }

  function isPublicCipherItem(item) {
    const effective = effectiveContentItem(item);
    return Boolean(
      effective
      && effective.type === "example"
      && markerValue(effective.description, "vault") === "v2"
      && !isExpiredContent(effective)
      && (effective.status === "active" || effective.status === "past_dates")
    );
  }

  function markManagerChangedCardsSeen(item, sourceCard, seen) {
    const cards = new Set();
    if (sourceCard) cards.add(sourceCard);
    if (item.id) {
      document.querySelectorAll(`[data-content-id="${CSS.escape(String(item.id))}"]`).forEach((card) => cards.add(card));
      const dynamicId = `admin-${String(item.id || item.title).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
      document.querySelectorAll(`[data-example-id="${CSS.escape(dynamicId)}"]`).forEach((card) => cards.add(card));
      if (String(item.id).startsWith("static-")) {
        const exampleId = String(item.id).slice("static-".length);
        document.querySelectorAll(`[data-example-id="${CSS.escape(exampleId)}"]`).forEach((card) => cards.add(card));
      }
    }
    cards.forEach((card) => {
      if (!card?.dataset?.exampleId) return;
      seen[card.dataset.exampleId] = card.dataset.uploaded || new Date().toISOString().slice(0, 10);
      cancelScheduledSeen(card);
      setCardState(card, seen);
      card.classList.remove("is-new");
      card.classList.add("is-seen");
      const badge = card.querySelector(".new-badge");
      if (badge) badge.hidden = true;
    });
    writeSeen(seen);
  }

  function renderManagerArchive(seen) {
    const panel = document.getElementById("examplesManagerArchive");
    const list = document.getElementById("examplesArchiveList");
    const count = document.getElementById("examplesArchiveCount");
    const toggle = document.getElementById("examplesArchiveToggle");
    if (!panel || !list || !count) return;
    const items = archivedItems();
    const archiveOpen = effectiveManagerMode() && toggle?.getAttribute("aria-expanded") === "true";
    panel.hidden = !archiveOpen;
    count.textContent = `${items.length} בארכיון`;
    if (toggle) {
      toggle.hidden = !effectiveManagerMode();
      toggle.textContent = `${archiveOpen ? "סגור ארכיון" : "כניסה לארכיון"} (${items.length})`;
    }
    if (!effectiveManagerMode()) return;
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "archive-item";
      empty.innerHTML = "<div><strong>אין כרגע צפנים בארכיון</strong><small>לחיצה על ארכיון בצופן תעביר אותו לכאן ותוציא אותו מהאוצר הפעיל.</small></div>";
      list.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "archive-item";
      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.title || "צופן בארכיון";
      const detail = document.createElement("small");
      detail.textContent = archiveDetailFor(item);
      text.append(title, detail);
      const actions = document.createElement("div");
      actions.className = "archive-actions";
      const changeStatus = (label, status) => {
        const button = document.createElement("button");
        button.className = "button secondary";
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const next = { ...item, status, updated_at: new Date().toISOString() };
            await upsertContent(next);
            if (status === "archive" || status === "draft") rememberLocalArchive(next);
            else forgetLocalArchive(next);
            updateCardAfterManagerStatus(next, seen);
            if (status !== "archive" && status !== "draft") markManagerChangedCardsSeen(next, null, seen);
            renderManagerArchive(seen);
            applyFilter(seen);
            updateVaultPicker();
          } catch (error) {
            alert(error.message || "הפעולה נכשלה.");
          } finally {
            button.disabled = false;
          }
        });
        return button;
      };
      actions.append(
        changeStatus("פרסם מחדש", "active"),
        changeStatus("תאריכי עבר", "past_dates")
      );
      row.append(text, actions);
      list.appendChild(row);
    });
  }

  async function loadPublishedContent(seen) {
    const layout = document.querySelector(".sample-layout");
    if (!layout) return;
    hideStaticCardsUntilContentLoads(seen);
    try {
      let items = [];
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from("admin_content")
          .select("id,type,title,url,status,description,created_at,updated_at")
          .eq("type", "example")
          .order("updated_at", { ascending: false });
        if (error) {
          applyLocalArchivedContent(seen);
          return;
        }
        items = data || [];
      } else {
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
        if (!response.ok) {
          applyLocalArchivedContent(seen);
          return;
        }
        items = await response.json();
      }
      remoteContentLoaded = true;
      if (!Array.isArray(items) || !items.length) {
        hideUnpublishedStaticCards(new Set(), seen);
        return;
      }
      items.forEach(rememberContentItem);
      applyLocalArchivedContent(seen);
      await archiveExpiredContent(items);
      items
        .map(effectiveContentItem)
        .filter((item) => String(item.id || "").startsWith("static-"))
        .forEach((item) => applyStaticOverride(item, seen));
      applyLocalArchivedContent(seen);
      hideUnpublishedStaticCards(new Set(
        items
          .map(effectiveContentItem)
          .filter((item) => String(item.id || "").startsWith("static-") && isPublicCipherItem(item))
          .map((item) => String(item.id))
      ), seen);
      applyFilter(seen);
      items.forEach((item) => {
        const effective = effectiveContentItem(item);
        if (!isPublicCipherItem(effective)) return;
        const id = `admin-${String(effective.id || effective.title).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
        if (document.querySelector(`[data-example-id="${CSS.escape(id)}"]`)) return;
        const card = cardForContent(effective);
        layout.prepend(card);
        setCardState(card, seen);
        addCipherFeedback(card);
        card.querySelector(".mark-unseen")?.addEventListener("click", () => markUnseen(card, seen));
      });
      updateVaultPicker();
      wireShareAndAdminTools(seen);
      renderManagerArchive(seen);
      window.GalEinaiWireSampleCards?.();
      wireSeenOnView(seen);
      applyFilter(seen);
    } catch {
      applyLocalArchivedContent(seen);
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
    if (card.dataset.adminHidden === "true") {
      applyFilter(seen);
      return;
    }
    document.querySelectorAll("[data-example-filter]").forEach((item) => item.classList.remove("is-active"));
    document.querySelector('[data-example-filter="all"]')?.classList.add("is-active");
    document.querySelectorAll("[data-topic-filter]").forEach((item) => item.classList.remove("is-active"));
    document.querySelector('[data-topic-filter="all"]')?.classList.add("is-active");
    applyFilter(seen);
    card.hidden = false;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      if (hasMeaningfulVisibility(card)) markSeen(card, seen);
    }, VIEW_DELAY_MS);
    card.classList.add("vault-focus");
    window.setTimeout(() => card.classList.remove("vault-focus"), 1800);
  }

  function applyFilter(seen) {
    const filter = activeFilter();
    const topic = activeTopic();
    const cards = Array.from(document.querySelectorAll("[data-example-id]"));
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
    updateCounter(cards.filter((card) => card.dataset.adminHidden !== "true"), visibleCards);
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
    if (!effectiveManagerMode() || card.querySelector(".cipher-admin-actions")) return;
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
    const actions = [
      action("ניהול", () => openCipherManager(card, seen)),
      action("ארכיון", async () => {
        if (!window.confirm(`להעביר את "${titleForCard(card)}" לארכיון ולהוציא אותו מהאוצר הפעיל?`)) return;
        await saveManagedCard(card, seen, { status: "archive" });
      })
    ];
    area.append(...actions);
    ensureToolArea(card).appendChild(area);
  }

  async function saveManagedCard(card, seen, patch = {}) {
    const status = patch.status || "active";
    const item = payloadForCard(card, status, patch);
    await upsertContent(item);
    if (status === "archive" || status === "draft") {
      rememberLocalArchive(item);
      hideArchivedCards(item, card, seen);
      renderManagerArchive(seen);
      document.getElementById("examplesManagerArchive")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      forgetLocalArchive(item);
      updateCardAfterManagerStatus(item, seen);
      markManagerChangedCardsSeen(item, card, seen);
    }
    applyFilter(seen);
    updateVaultPicker();
    renderManagerArchive(seen);
    return item;
  }

  async function removeManagedCard(card, seen) {
    const id = itemIdForCard(card);
    if (!id) return;
    await deleteContent(id);
    contentById.delete(id);
    forgetLocalArchive({ id });
    card.dataset.adminHidden = "true";
    card.hidden = true;
    card.remove();
    applyFilter(seen);
    updateVaultPicker();
    renderManagerArchive(seen);
  }

  function openCipherManager(card, seen) {
    const dialog = document.getElementById("cipherManagerDialog");
    const form = document.getElementById("cipherManagerForm");
    if (!dialog || !form) return;
    const item = contentById.get(itemIdForCard(card)) || payloadForCard(card, card.dataset.topic === "past_dates" ? "past_dates" : "active");
    document.getElementById("cipherManagerCardId").value = card.dataset.exampleId || "";
    document.getElementById("cipherManagerHeading").textContent = titleForCard(card) || "עריכת צופן";
    document.getElementById("cipherManagerTitle").value = item.title || titleForCard(card);
    document.getElementById("cipherManagerTopic").value = topicFor(item);
    document.getElementById("cipherManagerUrl").value = absoluteUrl(item.url || primaryUrlForCard(card));
    document.getElementById("cipherManagerDescription").value = cleanDescription(item.description) || card.querySelector("p")?.textContent?.trim() || "";
    document.getElementById("cipherManagerStatus").value = item.status || (card.dataset.topic === "past_dates" ? "past_dates" : "active");
    document.getElementById("cipherManagerStatusText").textContent = "";
    form._managedCard = card;
    form._seenState = seen;
    showDialog(dialog);
  }

  function wireShareAndAdminTools(seen) {
    document.querySelectorAll("[data-example-id]").forEach((card) => {
      addShareButton(card);
      addAdminActions(card, seen);
    });
  }

  function updateManagerPreviewControls(seen) {
    const strip = document.getElementById("examplesManagerStrip");
    const button = document.getElementById("publicPreviewToggle");
    if (strip) strip.hidden = !managerMode;
    document.body.classList.toggle("manager-mode", managerMode);
    document.body.classList.toggle("public-preview-mode", publicPreviewMode);
    if (button) {
      button.textContent = publicPreviewMode ? "חזרה למצב מנהל" : "תצוגה ציבורית";
      button.setAttribute("aria-pressed", String(publicPreviewMode));
    }
    wireShareAndAdminTools(seen);
    renderManagerArchive(seen);
  }

  function wireManagerPreviewToggle(seen) {
    wireManagerGesture(seen);
    document.querySelector("[data-close-vault-login]")?.addEventListener("click", () => {
      closeDialog(document.getElementById("vaultManagerLogin"));
    });
    document.getElementById("vaultManagerLoginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = document.getElementById("vaultManagerPassword");
      const status = document.getElementById("vaultManagerLoginStatus");
      if (status) status.textContent = "בודק סיסמה...";
      try {
        const ok = await sha256Hex(password?.value || "") === MANAGER_PASSWORD_HASH;
        if (!ok) {
          if (status) status.textContent = "סיסמה לא נכונה.";
          return;
        }
        writeManagerSession();
        enableManagerMode(seen);
        closeDialog(document.getElementById("vaultManagerLogin"));
      } catch {
        if (status) status.textContent = "לא הצלחתי לבדוק את הסיסמה בדפדפן הזה.";
      }
    });
    document.getElementById("examplesArchiveToggle")?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      const isOpen = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", isOpen ? "false" : "true");
      renderManagerArchive(seen);
    });
    document.getElementById("publicPreviewToggle")?.addEventListener("click", () => {
      publicPreviewMode = !publicPreviewMode;
      updateManagerPreviewControls(seen);
      applyFilter(seen);
      updateVaultPicker();
    });
    document.getElementById("managerLogoutButton")?.addEventListener("click", () => {
      disableManagerMode(seen);
    });
    document.querySelector("[data-close-cipher-manager]")?.addEventListener("click", () => {
      closeDialog(document.getElementById("cipherManagerDialog"));
    });
    document.querySelector("[data-manager-archive]")?.addEventListener("click", async () => {
      const form = document.getElementById("cipherManagerForm");
      const status = document.getElementById("cipherManagerStatusText");
      const card = form?._managedCard;
      if (!card) return;
      if (!window.confirm(`להעביר את "${titleForCard(card)}" לארכיון ולהוציא אותו מהאוצר הפעיל?`)) return;
      try {
        if (status) status.textContent = "מעביר לארכיון...";
        await saveManagedCard(card, seen, { status: "archive" });
        closeDialog(document.getElementById("cipherManagerDialog"));
      } catch (error) {
        if (status) status.textContent = error.message || "המעבר לארכיון נכשל.";
      }
    });
    document.querySelector("[data-manager-delete]")?.addEventListener("click", async () => {
      const form = document.getElementById("cipherManagerForm");
      const status = document.getElementById("cipherManagerStatusText");
      const card = form?._managedCard;
      if (!card) return;
      if (!window.confirm(`למחוק לגמרי את "${titleForCard(card)}"? פעולה זו מוחקת את רשומת הצופן מהאוצר.`)) return;
      try {
        if (status) status.textContent = "מוחק...";
        await removeManagedCard(card, seen);
        closeDialog(document.getElementById("cipherManagerDialog"));
      } catch (error) {
        if (status) status.textContent = error.message || "המחיקה נכשלה.";
      }
    });
    document.getElementById("cipherManagerForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const card = form._managedCard;
      const status = document.getElementById("cipherManagerStatusText");
      if (!card) return;
      const topic = document.getElementById("cipherManagerTopic")?.value || "events";
      const nextStatus = document.getElementById("cipherManagerStatus")?.value || "active";
      const patch = {
        title: document.getElementById("cipherManagerTitle")?.value?.trim() || titleForCard(card),
        topic,
        url: absoluteUrl(document.getElementById("cipherManagerUrl")?.value?.trim() || primaryUrlForCard(card)),
        description: metadataForCard(card, {
          topic,
          url: document.getElementById("cipherManagerUrl")?.value?.trim() || primaryUrlForCard(card),
          description: document.getElementById("cipherManagerDescription")?.value?.trim() || ""
        })
      };
      try {
        if (status) status.textContent = "שומר...";
        await saveManagedCard(card, seen, { ...patch, status: nextStatus });
        if (status) status.textContent = "נשמר.";
        if (nextStatus !== "archive" && nextStatus !== "draft") closeDialog(document.getElementById("cipherManagerDialog"));
      } catch (error) {
        if (status) status.textContent = error.message || "השמירה נכשלה.";
      }
    });
  }

  function wireManagerGesture(seen) {
    const buttons = Array.from(document.querySelectorAll(".examples-topic-filter [data-topic-filter]"));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last || first === last || first.dataset.managerGestureWired === "true") return;
    first.dataset.managerGestureWired = "true";
    last.dataset.managerGestureWired = "true";
    first.draggable = true;
    last.draggable = true;
    let dragSource = null;
    let pointerSource = null;
    let pointerStart = null;
    let pointerArmed = false;
    const opposite = (source, target) => (source === first && target === last) || (source === last && target === first);
    const markSource = (button) => {
      dragSource = button;
      button.classList.add("manager-gesture-source");
    };
    const clearSource = () => {
      first.classList.remove("manager-gesture-source");
      last.classList.remove("manager-gesture-source");
      dragSource = null;
      pointerSource = null;
      pointerStart = null;
      pointerArmed = false;
    };
    const finishPointerGesture = (event) => {
      if (!pointerSource || !pointerStart) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".examples-topic-filter [data-topic-filter]");
      const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      if (pointerArmed && distance > 40 && target && opposite(pointerSource, target)) {
        event.preventDefault();
        openManagerLogin(seen);
      }
      clearSource();
    };
    document.addEventListener("pointerup", finishPointerGesture, true);
    document.addEventListener("pointercancel", clearSource, true);
    [first, last].forEach((button) => {
      button.addEventListener("dragstart", (event) => {
        markSource(button);
        event.dataTransfer?.setData("text/plain", button.dataset.topicFilter || "");
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      button.addEventListener("dragend", clearSource);
      button.addEventListener("dragover", (event) => {
        if (dragSource && opposite(dragSource, button)) event.preventDefault();
      });
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        if (dragSource && opposite(dragSource, button)) openManagerLogin(seen);
        clearSource();
      });
      button.addEventListener("pointerdown", (event) => {
        pointerSource = button;
        pointerStart = { x: event.clientX, y: event.clientY };
        pointerArmed = true;
        markSource(button);
      });
    });
  }

  async function detectManagerMode(seen) {
    managerMode = readManagerSession();
    publicPreviewMode = false;
    updateManagerPreviewControls(seen);
    renderManagerArchive(seen);
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
  applyLocalArchivedContent(seen);
  applyFilter(seen);
  updateVaultPicker();
  wireCipherFeedback();
  wireShareAndAdminTools(seen);
  wireManagerPreviewToggle(seen);
  detectManagerMode(seen);
  wireSeenOnView(seen);
  loadPublishedContent(seen);
})();
