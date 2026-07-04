(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const BANK = {
    general: ["אמת", "שלום", "תורה", "ברכה", "הצלחה", "חסד", "אחריות", "סיעתא", "שמחה", "ישועה"],
    shidduch: ["שלום", "בית", "תורה", "יראת שמים", "מידות טובות", "חסד", "שמחה", "אחריות", "ענוה", "ברכה", "נחת", "התאמה"],
    work: ["אחריות", "אמינות", "דייקנות", "חריצות", "התמדה", "מקצועיות", "שירות", "שיתוף", "יציבות", "ברכה", "הצלחה"],
    event: ["זמן", "תאריך", "מקום", "מאורע", "סיבה", "תוצאה", "התחלה", "סיום", "ישועה", "רחמים", "שלום"],
  };
  const BLOCKED = [
    "רשע", "רע", "שקרן", "עצלן", "גנב", "חולה", "מסוכן", "פסול", "אשם", "בוגד",
    "שנאה", "קללה", "כישלון", "נוכל", "טיפש", "בעייתי", "מקולקל"
  ];

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
      // Local storage is optional.
    }
  }

  function splitWords(text) {
    return text
      .split(/[\n,;]+/)
      .map((word) => word.trim())
      .filter(Boolean);
  }

  function canonical(text) {
    return text.replace(/[^\u0590-\u05ff0-9]/g, "");
  }

  function uniqueWords(words) {
    const seen = new Set();
    const kept = [];
    words.forEach((word) => {
      const key = canonical(word);
      if (!key || seen.has(key)) return;
      seen.add(key);
      kept.push(word);
    });
    return kept;
  }

  function filterWords(words) {
    const blocked = [];
    const allowed = [];
    const blockedKeys = BLOCKED.map(canonical);
    words.forEach((word) => {
      const key = canonical(word);
      if (blockedKeys.some((bad) => bad && key.includes(bad))) blocked.push(word);
      else allowed.push(word);
    });
    return { allowed: uniqueWords(allowed), blocked: uniqueWords(blocked) };
  }

  function renderChips(words) {
    const box = $("aiWordChips");
    box.replaceChildren();
    words.forEach((word) => {
      const chip = document.createElement("span");
      chip.textContent = word;
      box.appendChild(chip);
    });
  }

  function buildSuggestions() {
    const domain = $("aiDomain").value;
    const topicWords = splitWords($("aiTopic").value);
    const names = splitWords($("aiNames").value);
    const dates = splitWords($("aiDates").value);
    const extras = splitWords($("aiExtraWords").value);
    const bank = BANK[domain] || BANK.general;
    const combined = [...names, ...dates, ...topicWords, ...extras, ...bank];
    return filterWords(combined);
  }

  $("aiGuideForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!$("aiConsent").checked) return;
    const { allowed, blocked } = buildSuggestions();
    renderChips(allowed);
    $("aiBlockedWords").textContent = blocked.length ? blocked.join(", ") : "לא סוננו מילים.";
    $("aiSummary").value = [
      "עיון AI מונחה - גל עיני",
      "",
      `תחום: ${$("aiDomain").selectedOptions[0]?.textContent || ""}`,
      `שאלה מנחה: ${$("aiTopic").value.trim()}`,
      "",
      "מילים מוצעות לחיפוש:",
      allowed.join("\n"),
      "",
      "הערה: זהו כלי עזר לעיון בלבד, ללא הכרעה על אדם וללא לשון הרע.",
    ].join("\n");
    $("copyAiWordsButton").disabled = !allowed.length;
    $("aiStatus").textContent = `נבנתה רשימה של ${allowed.length} מילים מותרות לעיון.`;
    const store = readStore();
    store.aiGuides = Array.isArray(store.aiGuides) ? store.aiGuides : [];
    store.aiGuides.push({
      domain: $("aiDomain").value,
      topic: $("aiTopic").value.trim(),
      words: allowed,
      blocked,
      at: new Date().toISOString(),
    });
    writeStore(store);
  });

  $("copyAiWordsButton").addEventListener("click", async () => {
    const text = $("aiSummary").value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      $("aiStatus").textContent = "הרשימה הועתקה.";
    } catch {
      $("aiSummary").focus();
      $("aiSummary").select();
      $("aiStatus").textContent = "אפשר להעתיק ידנית מהתיבה.";
    }
  });
})();
