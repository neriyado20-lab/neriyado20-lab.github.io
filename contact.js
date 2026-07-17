(() => {
  const STORAGE_KEY = "gal-einai-contact-v1";
  const CONTACT_EMAIL = "neriyado20@gmail.com";
  const FORM_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;
  const $ = (id) => document.getElementById(id);

  function readItems() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-60)));
  }

  function buildSummary(item) {
    return [
      "פנייה מאתר גל עיני",
      "",
      `שם: ${item.name}`,
      `חזרה אלי: ${item.returnTo}`,
      `נושא: ${item.topic}`,
      `תאריך: ${new Date(item.at).toLocaleString("he-IL")}`,
      "",
      "תוכן הפנייה:",
      item.message,
    ].join("\n");
  }

  async function sendEmailNotification(item) {
    const form = new FormData();
    form.append("name", item.name);
    form.append("return_to", item.returnTo);
    form.append("topic", item.topic);
    form.append("message", item.message);
    form.append("_subject", `פנייה חדשה מאתר גל עיני - ${item.topic}`);
    form.append("_template", "table");
    form.append("_captcha", "false");
    form.append("_replyto", item.returnTo.includes("@") ? item.returnTo : CONTACT_EMAIL);
    form.append("summary", buildSummary(item));
    const response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
    });
    if (!response.ok) throw new Error("mail_failed");
    return true;
  }

  function renderList() {
    const box = $("contactList");
    const items = readItems();
    box.replaceChildren();
    if (!items.length) {
      box.textContent = "אין עדיין פניות שמורות במכשיר זה.";
      return;
    }
    items.slice().reverse().slice(0, 20).forEach((item) => {
      const article = document.createElement("article");
      article.className = "rides-item";
      const title = document.createElement("strong");
      title.textContent = `${item.topic} - ${item.name}`;
      const meta = document.createElement("span");
      meta.textContent = `${item.returnTo} | ${new Date(item.at).toLocaleString("he-IL")}`;
      const body = document.createElement("small");
      body.textContent = item.message;
      article.append(title, meta, body);
      box.appendChild(article);
    });
  }

  $("contactForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = {
      id: `contact-${Date.now()}`,
      name: $("contactName").value.trim(),
      returnTo: $("contactReturn").value.trim(),
      topic: $("contactTopic").value,
      message: $("contactMessage").value.trim(),
      at: new Date().toISOString(),
    };
    const items = readItems();
    items.push(item);
    writeItems(items);
    let savedRemote = false;
    let sentEmail = false;
    if (window.GalEinaiBackend) {
      savedRemote = await window.GalEinaiBackend.submit("contact", item);
    }
    try {
      sentEmail = await sendEmailNotification(item);
    } catch {
      sentEmail = false;
    }
    $("contactSummary").value = buildSummary(item);
    $("copyContactButton").disabled = false;
    $("contactStatus").textContent = sentEmail
      ? "הפנייה נשלחה למייל ונשמרה במערכת."
      : savedRemote
      ? "הפנייה נשמרה במערכת. שליחת המייל הזמנית עדיין דורשת אישור/בדיקה."
      : "הפנייה נשמרה במכשיר. אם המייל הזמני עדיין לא הופעל, אפשר להעתיק את הנוסח.";
    renderList();
  });

  $("copyContactButton").addEventListener("click", async () => {
    const text = $("contactSummary").value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      $("contactStatus").textContent = "הנוסח הועתק.";
    } catch {
      $("contactSummary").focus();
      $("contactSummary").select();
      $("contactStatus").textContent = "אפשר להעתיק ידנית מהתיבה.";
    }
  });

  renderList();
})();
