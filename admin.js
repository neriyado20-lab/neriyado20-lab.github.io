(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const CONFIG = window.GAL_EINAI_INTERACTIONS || {};
  const CIPHER_TITLES = {
    "ketamuz-1407": "כתמוז 1407",
    "ketamuz-hatashpu": "כתמוז תשפו",
    "rav-amos-hatashpu-milchama": "הרב עמוס התשפו מלחמה",
    "atom-petzatza-iran": "אטום פצצה אירן",
    "vetamuz-hatashpu-yenatzchu": "ותמוז התשפו ינצחו",
    "tamuz-hatashpu-podeh-melech-71": "תמוז התשפו פודה מלך 71",
    "geula-m-hapeh-bigevura": "גאולה מ ה-פה בגבורה",
    "hey-july": "ה יולי",
    "yom-mashiach-ba-583-ketamuz": "יום משיח בא 583 כתמוז",
    "leshiul-shemen-zayit-lechem-boker": "לשיעול שמן זית ולחם בקר",
    "heymanot-kesau": "הימנוט קסאו"
  };

  function $(id) {
    return document.getElementById(id);
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function titleFor(id) {
    return CIPHER_TITLES[id] || id;
  }

  function row(title, detail) {
    const item = document.createElement("div");
    item.className = "admin-list-item";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = detail;
    item.append(strong, span);
    return item;
  }

  function render() {
    const store = readStore();
    const likes = store.likes || {};
    const reviews = store.reviews || {};
    const interestIds = Object.entries(likes).filter(([, value]) => Boolean(value)).map(([id]) => id);
    const notes = Object.entries(reviews).flatMap(([id, items]) => (
      Array.isArray(items) ? items.map((item) => ({ id, ...item })) : []
    ));

    $("adminSiteVisits").textContent = store.siteVisits || 0;
    $("adminWebUses").textContent = store.webUses || 0;
    $("adminExamplesVisits").textContent = store.examplesVisits || 0;
    $("adminInterestCount").textContent = interestIds.length;

    const interestList = $("adminInterestList");
    interestList.replaceChildren();
    if (!interestIds.length) {
      interestList.append(row("אין עדיין סימוני עיון", "כאשר משתמש יסמן צופן כראוי לעיון, הוא יופיע כאן."));
    } else {
      interestIds.forEach((id) => interestList.append(row(titleFor(id), "סומן לעיון במכשיר זה")));
    }

    const notesList = $("adminNotesList");
    notesList.replaceChildren();
    if (!notes.length) {
      notesList.append(row("אין עדיין הערות עיון", "הערות קצרות על צפנים יופיעו כאן."));
    } else {
      notes.slice().reverse().forEach((note) => {
        const date = note.at ? new Date(note.at).toLocaleString("he-IL") : "";
        notesList.append(row(titleFor(note.id), `${note.text || ""}${date ? ` | ${date}` : ""}`));
      });
    }

    const notifyList = $("adminNotifyList");
    notifyList.replaceChildren();
    if (store.notifyContact) {
      notifyList.append(row("פרטי הודעה שמורים", store.notifyContact));
    } else {
      notifyList.append(row("אין נרשמים במכשיר זה", "לאחר חיבור שירות מרכזי תופיע כאן רשימת הנרשמים."));
    }

    const ordersList = $("adminOrdersList");
    if (ordersList) {
      const orders = Array.isArray(store.cipherOrders) ? store.cipherOrders : [];
      ordersList.replaceChildren();
      if (!orders.length) {
        ordersList.append(row("אין עדיין בקשות", "בקשות חיפוש צופן שיוכנו במכשיר זה יופיעו כאן."));
      } else {
        orders.slice().reverse().forEach((order) => {
          const date = order.at ? new Date(order.at).toLocaleString("he-IL") : "";
          ordersList.append(row(order.topic || "בקשת בדיקה", `${order.contact || ""}${date ? ` | ${date}` : ""}`));
        });
      }
    }

    $("adminBackendStatus").textContent = CONFIG.enabled && CONFIG.endpoint
      ? "חיבור נתונים מרכזי מוגדר."
      : "מצב נוכחי: נתונים מקומיים בלבד, ללא שליחה לשרת.";
  }

  function exportCsv() {
    const store = readStore();
    const reviews = store.reviews || {};
    const lines = [["type", "cipher", "value", "date"]];
    Object.entries(store.likes || {}).forEach(([id, marked]) => {
      if (marked) lines.push(["interest", titleFor(id), "marked", ""]);
    });
    Object.entries(reviews).forEach(([id, items]) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => lines.push(["note", titleFor(id), item.text || "", item.at || ""]));
    });
    if (store.notifyContact) lines.push(["notify", "", store.notifyContact, ""]);
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gal-einai-admin-local-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  $("refreshAdminButton").addEventListener("click", render);
  $("exportAdminButton").addEventListener("click", exportCsv);
  render();
})();
