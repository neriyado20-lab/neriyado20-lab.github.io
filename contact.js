(() => {
  const STORAGE_KEY = "gal-einai-contact-v1";
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
      "????? ???? ?? ????",
      "",
      `??: ${item.name}`,
      `???? ???: ${item.returnTo}`,
      `????: ${item.topic}`,
      `?????: ${new Date(item.at).toLocaleString("he-IL")}`,
      "",
      "???? ??????:",
      item.message,
    ].join("\n");
  }

  function renderList() {
    const box = $("contactList");
    const items = readItems();
    box.replaceChildren();
    if (!items.length) {
      box.textContent = "??? ????? ????? ?????? ?????? ??.";
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
    if (window.GalEinaiBackend) {
      await window.GalEinaiBackend.submit("contact", item);
    }
    $("contactSummary").value = buildSummary(item);
    $("copyContactButton").disabled = false;
    $("contactStatus").textContent = "?????? ?????, ????? ?????? ?? ????? ?????? ??????.";
    renderList();
  });

  $("copyContactButton").addEventListener("click", async () => {
    const text = $("contactSummary").value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      $("contactStatus").textContent = "????? ?????.";
    } catch {
      $("contactSummary").focus();
      $("contactSummary").select();
      $("contactStatus").textContent = "???? ?????? ????? ??????.";
    }
  });

  renderList();
})();
