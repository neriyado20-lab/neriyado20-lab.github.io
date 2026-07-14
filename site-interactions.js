(() => {
  const CONFIG = window.GAL_EINAI_INTERACTIONS || {};
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const ADDITIONS_KEY = "gal-einai-my-cipher-additions-v1";

  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Local fallback is optional; the interface remains usable without it.
    }
  }

  function readAdditions() {
    try {
      const raw = localStorage.getItem(ADDITIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeAdditions(items) {
    try {
      localStorage.setItem(ADDITIONS_KEY, JSON.stringify(items.slice(-50)));
    } catch {
      // The backend submission can still succeed even when local storage is blocked.
    }
  }

  function projectUrlFor(card) {
    const projectLink = Array.from(card.querySelectorAll("a[href]")).find((link) => {
      const href = link.getAttribute("href") || "";
      return href.includes("web.html?project=") || href.endsWith(".gal_einai.json");
    });
    if (!projectLink) return "";
    const href = projectLink.getAttribute("href") || "";
    try {
      return new URL(href, location.href).href;
    } catch {
      return href;
    }
  }

  function shareUrlFor(card) {
    const project = projectUrlFor(card);
    if (project) return project;
    const imageLink = card.querySelector(".sample-image-link[href], a.track-view[href]");
    const href = imageLink?.getAttribute("href") || location.href;
    try {
      return new URL(href, location.href).href;
    } catch {
      return href;
    }
  }

  function setShareStatus(target, text) {
    if (!target) return;
    target.textContent = text;
    window.setTimeout(() => {
      if (target.textContent === text) target.textContent = "";
    }, 3500);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }

  async function runShareAction(action, card, title, status) {
    const url = shareUrlFor(card);
    const text = `צופן מתוך גל עיני: ${title}`;
    if (action === "native") {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareStatus(status, "השיתוף נפתח.");
      } else {
        await copyText(url);
        setShareStatus(status, "הקישור הועתק.");
      }
      return;
    }
    if (action === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
      setShareStatus(status, "נפתח שיתוף ב-WhatsApp.");
      return;
    }
    if (action === "copy") {
      await copyText(url);
      setShareStatus(status, "הקישור הועתק.");
      return;
    }
    if (action === "email") {
      location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n${url}`)}`;
      return;
    }
    if (action === "project") {
      const project = projectUrlFor(card);
      if (project) {
        location.href = project;
        return;
      }
      setShareStatus(status, "בצופן הזה אין עדיין קובץ פרויקט פתוח.");
    }
  }

  async function sendEvent(type, payload) {
    const kindByType = {
      notify_signup: "notification",
      cipher_interest: "interest",
      cipher_note: "note",
    };
    if (window.GalEinaiBackend && kindByType[type]) {
      return window.GalEinaiBackend.submit(kindByType[type], {
        ...payload,
        page: location.pathname,
        at: new Date().toISOString(),
      });
    }
    if (!CONFIG.enabled || !CONFIG.endpoint) return false;
    try {
      await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          payload,
          page: location.pathname,
          at: new Date().toISOString(),
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  function pageKey() {
    const name = location.pathname.split("/").pop() || "index.html";
    if (name === "web.html") return "webUses";
    if (name === "examples.html") return "examplesVisits";
    return "siteVisits";
  }

  function updateActivity(store) {
    const target = document.getElementById("siteActivity");
    if (!target) return;
    const visits = store.siteVisits || 0;
    const webUses = store.webUses || 0;
    const examplesVisits = store.examplesVisits || 0;
    target.textContent = `במכשיר זה: ${visits} כניסות | ${webUses} שימושים בתוכנה | ${examplesVisits} צפייה באוצר הצפנים`;
  }

  function countVisit(store) {
    const key = pageKey();
    store[key] = (store[key] || 0) + 1;
    writeStore(store);
    updateActivity(store);
    sendEvent("page_visit", { key, count: store[key] });
  }

  function ensureFeedback(card, store) {
    if (!card.classList.contains("sample-card")) return;
    const id = card.dataset.exampleId;
    if (!id || card.querySelector(".cipher-feedback")) return;
    const title = card.querySelector("h2")?.textContent?.trim() || id;
    const feedback = document.createElement("section");
    feedback.className = "cipher-feedback";
    feedback.innerHTML = `
      <div class="feedback-row">
        <button class="button secondary like-cipher" type="button" aria-pressed="false">ראוי לעיון</button>
        <button class="button secondary request-additions" type="button">ראיתי תוספות</button>
        <label class="cipher-share-menu">
          <span>שתף צופן</span>
          <select class="cipher-share-select">
            <option value="">בחר פעולה</option>
            <option value="native">שיתוף רגיל</option>
            <option value="whatsapp">שלח ל-WhatsApp</option>
            <option value="copy">העתק קישור</option>
            <option value="email">שלח במייל</option>
            <option value="project">פתח קובץ פרויקט</option>
          </select>
        </label>
        <span class="like-count">0 סימוני עיון במכשיר זה</span>
      </div>
      <small class="share-status" aria-live="polite"></small>
      <form class="addition-form" hidden>
        <label>
          <span>פרטי קשר לקבלת קובץ להמשך עבודה</span>
          <input class="addition-contact" maxlength="120" autocomplete="email tel" placeholder="מייל או טלפון">
        </label>
        <label>
          <span>מה ראית בצופן?</span>
          <textarea class="addition-text" rows="3" maxlength="500" placeholder="כתוב בקצרה את התוספות שראית"></textarea>
        </label>
        <div class="feedback-row">
          <button class="button primary" type="submit">שלח בקשה</button>
          <button class="button secondary cancel-addition" type="button">בטל</button>
        </div>
        <small class="addition-status" aria-live="polite"></small>
      </form>
      <form class="review-form">
        <label>
          <span>הערת עיון קצרה</span>
          <input maxlength="90" autocomplete="off" placeholder="משפט קצר לעיון על הצופן">
        </label>
        <button class="button secondary" type="submit">שמור</button>
      </form>
      <div class="review-list" aria-live="polite"></div>
    `;
    card.querySelector(".sample-copy")?.appendChild(feedback);

    const likes = store.likes || {};
    const liked = Boolean(likes[id]);
    const likeButton = feedback.querySelector(".like-cipher");
    const likeCount = feedback.querySelector(".like-count");
    const additionsButton = feedback.querySelector(".request-additions");
    const shareSelect = feedback.querySelector(".cipher-share-select");
    const shareStatus = feedback.querySelector(".share-status");
    const additionsForm = feedback.querySelector(".addition-form");
    const additionsContact = feedback.querySelector(".addition-contact");
    const additionsText = feedback.querySelector(".addition-text");
    const additionsStatus = feedback.querySelector(".addition-status");
    const additionsCancel = feedback.querySelector(".cancel-addition");
    const reviewForm = feedback.querySelector(".review-form");
    const reviewInput = feedback.querySelector(".review-form input");
    const reviewList = feedback.querySelector(".review-list");

    function renderLike() {
      const currentLikes = Object.values(likes).filter(Boolean).length;
      likeButton.setAttribute("aria-pressed", String(Boolean(likes[id])));
      likeButton.textContent = likes[id] ? "סומן לעיון" : "ראוי לעיון";
      likeCount.textContent = likes[id] ? "סימנת צופן זה לעיון" : `${currentLikes} סימוני עיון במכשיר זה`;
    }

    function renderReviews() {
      const reviews = (store.reviews && store.reviews[id]) || [];
      reviewList.replaceChildren();
      reviews.slice(-3).forEach((item) => {
        const line = document.createElement("p");
        line.textContent = item.text;
        reviewList.appendChild(line);
      });
    }

    likes[id] = liked;
    store.likes = likes;
    renderLike();
    renderReviews();

    likeButton.addEventListener("click", () => {
      likes[id] = !likes[id];
      store.likes = likes;
      writeStore(store);
      renderLike();
      sendEvent("cipher_interest", { id, title, marked: likes[id] });
    });

    additionsButton.addEventListener("click", () => {
      additionsForm.hidden = false;
      additionsContact.focus();
    });

    additionsCancel.addEventListener("click", () => {
      additionsForm.hidden = true;
      additionsStatus.textContent = "";
    });

    additionsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const contact = additionsContact.value.trim().slice(0, 120);
      const details = additionsText.value.trim().slice(0, 500);
      if (!contact || !details) {
        additionsStatus.textContent = "צריך למלא פרטי קשר ותיאור קצר.";
        return;
      }
      const request = {
        id: `addition-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "cipher_addition_request",
        cipherId: id,
        title,
        contact,
        details,
        projectUrl: projectUrlFor(card),
        pageUrl: location.href,
        at: new Date().toISOString()
      };
      const additions = readAdditions();
      additions.push(request);
      writeAdditions(additions);
      sendEvent("cipher_note", request);
      additionsText.value = "";
      additionsStatus.textContent = request.projectUrl
        ? "הבקשה נשלחה. קישור הצופן זוהה ויופיע גם בדברים שלי."
        : "הבקשה נשלחה. בצופן הזה המנהל יצטרך לצרף קובץ פרויקט.";
    });

    shareSelect.addEventListener("change", async () => {
      const action = shareSelect.value;
      shareSelect.value = "";
      if (!action) return;
      try {
        await runShareAction(action, card, title, shareStatus);
      } catch {
        setShareStatus(shareStatus, "לא הצלחתי לבצע את פעולת השיתוף.");
      }
    });

    reviewForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = reviewInput.value.trim().slice(0, 90);
      if (!text) return;
      store.reviews = store.reviews || {};
      store.reviews[id] = store.reviews[id] || [];
      store.reviews[id].push({ text, at: new Date().toISOString() });
      writeStore(store);
      reviewInput.value = "";
      renderReviews();
      sendEvent("cipher_note", { id, title, text });
    });
  }

  function wireNotifications(store) {
    const form = document.getElementById("notifyForm");
    if (!form) return;
    const input = document.getElementById("notifyInput");
    const status = document.getElementById("notifyStatus");
    const saved = store.notifyContact || "";
    if (input && saved) input.value = saved;
    if (status && saved) status.textContent = "פרטי ההודעה שמורים במכשיר זה.";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const contact = input.value.trim().slice(0, 120);
      if (!contact) return;
      store.notifyContact = contact;
      writeStore(store);
      if (status) {
        status.textContent = CONFIG.enabled
          ? "נרשמת לקבלת הודעה על צופן חדש."
          : "נשמר במכשיר זה. שליחה אמיתית תופעל לאחר חיבור שירות הודעות.";
      }
      sendEvent("notify_signup", { contact });
    });
  }

  function ensureLegalFooter() {
    const footer = document.querySelector("footer");
    if (!footer || footer.querySelector("[data-legal-footer]")) return;
    const legal = document.createElement("span");
    legal.dataset.legalFooter = "true";
    legal.className = "legal-footer";
    const copyright = document.createElement("span");
    copyright.textContent = "© 2026 גל עיני. כל הזכויות שמורות.";
    const separator = document.createTextNode(" | ");
    const terms = document.createElement("a");
    terms.href = "terms.html";
    terms.textContent = "תנאי שימוש וזכויות יוצרים";
    legal.append(copyright, separator, terms);
    footer.appendChild(legal);
  }

  const store = readStore();
  countVisit(store);
  function wireSampleCards() {
    document.querySelectorAll(".sample-card[data-example-id]").forEach((card) => ensureFeedback(card, store));
  }
  window.GalEinaiWireSampleCards = wireSampleCards;
  wireSampleCards();
  wireNotifications(store);
  ensureLegalFooter();
})();
