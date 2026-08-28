(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const PLANS = {
    basic: { name: "חיפוש בסיסי", minWords: 10 },
    expanded: { name: "חיפוש מורחב", minWords: 10 },
    print: { name: "צופן להדפסה", minWords: 10 },
  };
  let selectedPlan = "basic";

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

  function setPlan(plan) {
    selectedPlan = PLANS[plan] ? plan : "basic";
    document.querySelectorAll("[data-order-plan]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.orderPlan === selectedPlan);
    });
  }

  function buildSummary(data) {
    const plan = PLANS[selectedPlan];
    return [
      "פנייה לחיפוש צופן - גל עיני",
      "",
      `סוג בקשה: ${data.kind === "existing-review" ? "עיון בצופן קיים" : "פנייה לחיפוש צופן חדש"}`,
      `מסלול מבוקש: ${plan.name}`,
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

  function countImportantWords(text) {
    return text
      .split(/[\n,;]+/)
      .map((word) => word.trim())
      .filter(Boolean).length;
  }

  document.querySelectorAll("[data-order-plan]").forEach((button) => {
    button.addEventListener("click", () => setPlan(button.dataset.orderPlan));
  });

  $("cipherOrderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = {
      plan: selectedPlan,
      kind: $("orderKind").value,
      topic: $("orderTopic").value.trim(),
      words: $("orderWords").value.trim(),
      question: $("orderQuestion").value.trim(),
      contact: $("orderContact").value.trim(),
      dedication: $("orderDedication").value.trim(),
      at: new Date().toISOString(),
    };
    if (!data.topic || !data.question || !data.contact) return;
    const plan = PLANS[selectedPlan];
    const wordCount = countImportantWords(data.words);
    if (wordCount < plan.minWords) {
      $("orderStatus").textContent = `נא לכתוב לפחות ${plan.minWords} מילים או ביטויים חשובים בנושא. כרגע הוזנו ${wordCount}.`;
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

  setPlan(selectedPlan);
})();
