(() => {
  const CONFIG = window.GAL_EINAI_INTERACTIONS || {};
  const STORAGE_KEY = "gal-einai-site-interactions-v1";

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

  async function sendEvent(type, payload) {
    const kindByType = {
      notify_signup: "notification",
      cipher_interest: "interest",
      cipher_note: "note"
    };
    if (window.GalEinaiBackend && kindByType[type]) {
      return window.GalEinaiBackend.submit(kindByType[type], {
        ...payload,
        page: location.pathname,
        at: new Date().toISOString()
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
          at: new Date().toISOString()
        })
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
    target.textContent = `במכשיר זה: ${visits} כניסות | ${webUses} שימושים בתוכנה | ${examplesVisits} צפייה בדוגמאות`;
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
        <span class="like-count">0 סימוני עיון במכשיר זה</span>
      </div>
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

  const store = readStore();
  countVisit(store);
  document.querySelectorAll(".sample-card[data-example-id]").forEach((card) => ensureFeedback(card, store));
  wireNotifications(store);
})();
