(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const PLANS = {
    basic: { name: "חיפוש בסיסי", price: 89, minWords: 10 },
    expanded: { name: "חיפוש מורחב", price: 180, minWords: 10 },
    print: { name: "צופן להדפסה", price: 360, minWords: 10 },
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
      "הזמנת חיפוש צופן - גל עיני",
      "",
      `סוג בקשה: ${data.kind === "existing-review" ? "עיון בצופן קיים" : "חיפוש צופן חדש לפי הזמנה"}`,
      `מסלול: ${plan.name} (${plan.price} ₪)`,
      `נושא: ${data.topic}`,
      "",
      "מילים / ביטויים:",
      data.words || "לא נמסרו מילים מיוחדות",
      "",
      `שאלה מנחה: ${data.question}`,
      `פרטי קשר: ${data.contact}`,
      data.dedication ? `הקדשה: ${data.dedication}` : "",
      "",
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

  $("cipherOrderForm").addEventListener("submit", (event) => {
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
    $("orderStatus").textContent = "הזמנת החיפוש הוכנה. אפשר להעתיק ולשלוח, ובהמשך נחבר שליחה ותשלום ישירים.";
  });

  $("copyOrderButton").addEventListener("click", async () => {
    const text = $("orderSummary").value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      $("orderStatus").textContent = "הבקשה הועתקה.";
    } catch {
      $("orderSummary").focus();
      $("orderSummary").select();
      $("orderStatus").textContent = "אפשר להעתיק ידנית מהתיבה.";
    }
  });

  setPlan(selectedPlan);
})();
