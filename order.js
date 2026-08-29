(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const MIN_WORDS = 6;
  const MIN_WORD_LENGTH = 4;

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

  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // The prepared request can still be copied even if storage is unavailable.
    }
  }

  function buildSummary(data) {
    return [
      "פנייה לחיפוש צופן - גל עיני",
      "",
      `סוג בקשה: ${data.kind === "existing-review" ? "עיון בצופן קיים" : "פנייה לחיפוש צופן חדש"}`,
      `נושא: ${data.topic}`,
      "",
      "מילים / ביטויים:",
      data.words || "לא נמסרו מילים מיוחדות",
      "",
      `שאלה מנחה: ${data.question}`,
      `פרטי קשר: ${data.contact}`,
      data.dedication ? `הקדשה: ${data.dedication}` : "",
      "",
      "תיאום ציפיות: הפנייה אינה תשלום ואינה התחייבות. סיכום היקף, זמן ועלות אם תהיה נעשה במענה אישי בצור קשר.",
      "הערה: החיפוש הוא עבודת חיפוש ועיון בלבד, ואין לראות בו הכרעה הלכתית או הוראה מעשית.",
    ].filter(Boolean).join("\n");
  }

  function importantWords(text) {
    return text
      .split(/[\n,;\s]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= MIN_WORD_LENGTH);
  }

  $("cipherOrderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = {
      kind: $("orderKind").value,
      topic: $("orderTopic").value.trim(),
      words: $("orderWords").value.trim(),
      question: $("orderQuestion").value.trim(),
      contact: $("orderContact").value.trim(),
      dedication: $("orderDedication").value.trim(),
      at: new Date().toISOString(),
    };
    if (!data.topic || !data.question || !data.contact) return;
    const wordCount = importantWords(data.words).length;
    if (wordCount < MIN_WORDS) {
      $("orderStatus").textContent = `נא לכתוב לפחות ${MIN_WORDS} מילים בנות ${MIN_WORD_LENGTH} אותיות ומעלה. כרגע נמצאו ${wordCount}.`;
      $("orderWords").focus();
      return;
    }
    const summary = buildSummary(data);
    $("orderSummary").value = summary;
    $("copyOrderButton").disabled = false;
    const store = readStore();
    store.cipherOrders = Array.isArray(store.cipherOrders) ? store.cipherOrders : [];
    store.cipherOrders.push({ ...data, summary });
    writeStore(store);
    if (window.GalEinaiBackend) {
      await window.GalEinaiBackend.submit("order", { ...data, summary });
    }
    $("orderStatus").textContent = "נוסח הפנייה הוכן. אפשר להעתיק ולשלוח דרך צור קשר; אין סליקה באתר בשלב זה.";
  });

  $("copyOrderButton").addEventListener("click", async () => {
    const text = $("orderSummary").value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      $("orderStatus").textContent = "הפנייה הועתקה. עכשיו אפשר לשלוח אותה בצור קשר.";
    } catch {
      $("orderSummary").focus();
      $("orderSummary").select();
      $("orderStatus").textContent = "אפשר להעתיק ידנית מהתיבה.";
    }
  });
})();