(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const BANK = {
    general: ["אמת", "שלום", "תורה", "ברכה", "הצלחה", "חסד", "אחריות", "סיעתא", "שמחה", "ישועה"],
    shidduch: ["שלום", "בית", "תורה", "יראת שמים", "מידות טובות", "חסד", "שמחה", "אחריות", "ענוה", "ברכה", "נחת", "התאמה"],
    work: ["אחריות", "אמינות", "דייקנות", "חריצות", "התמדה", "מקצועיות", "שירות", "שיתוף", "יציבות", "ברכה", "הצלחה"],
    event: ["זמן", "תאריך", "מקום", "מאורע", "סיבה", "תוצאה", "התחלה", "סיום", "ישועה", "רחמים", "שלום"],
    case: ["אמת", "בירור", "עדות", "סימן", "מקום", "זמן", "תאריך", "דרך", "עקבות", "חסר", "נמצא", "חיפוש", "מסמך", "טלפון", "רכב", "בית", "רחוב", "שעה", "קצה חוט", "השגחה", "אירוע", "פגיעה", "אובדן", "פריצה"],
    missing: ["מקום", "נמצא", "שלום", "חיים", "דרך", "רחוב", "בית", "בנין", "כניסה", "חדר", "חצר", "שדה", "יער", "הר", "נחל", "מים", "תחנה", "אוטובוס", "רכבת", "רכב", "טלפון", "סימן", "עקבות", "בגד", "תיק", "מסמך", "שעה", "תאריך", "חיפוש", "הצלה"],
  };
  const BLOCKED = [
    "רשע", "שקרן", "עצלן", "גנב", "חולה", "מסוכן", "פסול", "אשם", "בוגד",
    "שנאה", "קללה", "כישלון", "נוכל", "טיפש", "בעייתי", "מקולקל", "רוצח", "חשוד",
    "אנס", "אונס", "מחבל", "פושע", "פשע", "עבריין", "רצח", "שוד", "שודד"
  ];
  const EXACT_BLOCKED = ["רע"];
  const LETTER_VARIANTS = [
    ["ו", ""],
    ["י", ""],
    ["ה", "א"],
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
      .split(/[\s,;|]+/)
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

  function makeVariants(word) {
    const base = word.trim();
    const variants = new Set([base]);
    const key = canonical(base);
    if (!key || key.length < 4 || key.length > 8 || !/^[\u0590-\u05ff]+$/.test(base)) return [base];
    LETTER_VARIANTS.forEach(([from, to]) => {
      if (base.includes(from)) variants.add(base.replaceAll(from, to));
      if (to && base.includes(to)) variants.add(base.replaceAll(to, from));
    });
    if (base.endsWith("ה")) variants.add(`${base.slice(0, -1)}א`);
    return uniqueWords([...variants]).slice(0, 4);
  }

  function scoreWord(word, source, domain) {
    const clean = canonical(word);
    let score = 30;
    if (source === "name") score += 45;
    if (source === "date") score += 35;
    if (source === "topic") score += 15;
    if (source === "extra") score += 40;
    if (source === "detail") score += 55;
    if (source === "bank") score += 12;
    if ((domain === "case" || domain === "missing") && source !== "topic" && ["מקום", "זמן", "תאריך", "עדות", "סימן", "חיפוש", "עקבות", "דרך", "רחוב", "בית", "רכב", "טלפון"].some((term) => clean.includes(canonical(term)))) score += 18;
    if (domain === "missing" && ["מקום", "נמצא", "דרך", "רחוב", "בית", "תחנה", "רכב", "טלפון", "סימן", "עקבות", "בגד", "תיק", "מים"].some((term) => clean.includes(canonical(term)))) score += 20;
    if (clean.length >= 4 && clean.length <= 8) score += 10;
    if (clean.length > 12) score -= 8;
    return score;
  }

  function rankWords(groups, domain) {
    const ranked = [];
    Object.entries(groups).forEach(([source, words]) => {
      words.forEach((word) => {
        makeVariants(word).forEach((variant, index) => {
          ranked.push({
            word: variant,
            score: scoreWord(variant, source, domain) - index * 35,
            source,
          });
        });
      });
    });
    const { allowed, blocked } = filterWords(ranked.map((item) => item.word));
    const byKey = new Map();
    ranked.forEach((item) => {
      const key = canonical(item.word);
      if (!key || !allowed.some((word) => canonical(word) === key)) return;
      const existing = byKey.get(key);
      if (!existing || item.score > existing.score) byKey.set(key, item);
    });
    const ordered = [...byKey.values()].sort((a, b) => b.score - a.score || a.word.length - b.word.length);
    return { ordered, allowed: ordered.map((item) => item.word), blocked };
  }

  function filterWords(words) {
    const blocked = [];
    const allowed = [];
    const blockedKeys = BLOCKED.map(canonical);
    const exactBlockedKeys = EXACT_BLOCKED.map(canonical);
    words.forEach((word) => {
      const key = canonical(word);
      if (
        exactBlockedKeys.some((bad) => bad && key === bad) ||
        blockedKeys.some((bad) => bad && key.includes(bad))
      ) blocked.push(word);
      else allowed.push(word);
    });
    return { allowed: uniqueWords(allowed), blocked: uniqueWords(blocked) };
  }

  function renderChips(words) {
    const box = $("aiWordChips");
    box.replaceChildren();
    words.forEach((item) => {
      const chip = document.createElement("span");
      chip.textContent = typeof item === "string" ? item : `${item.word} · ${item.score}`;
      box.appendChild(chip);
    });
  }

  function buildSuggestions() {
    const domain = $("aiDomain").value;
    const topicWords = splitWords($("aiTopic").value);
    const names = splitWords($("aiNames").value);
    const dates = splitWords($("aiDates").value);
    const extras = splitWords($("aiExtraWords").value);
    const caseDetails = splitWords($("aiCaseDetails")?.value || "");
    const bank = BANK[domain] || BANK.general;
    const groups = {
      name: domain === "case" || domain === "missing" ? [] : names,
      date: dates,
      topic: topicWords,
      extra: extras,
      detail: caseDetails,
      bank,
    };
    return { ...rankWords(groups, domain), namesHeld: uniqueWords(names) };
  }

  function buildWebUrl(allowed) {
    const primary = allowed[0] || "";
    const secondary = allowed.slice(1, 18).join(" ");
    const params = new URLSearchParams();
    if (primary) params.set("primary", primary);
    if (secondary) params.set("secondary", secondary);
    params.set("skipFrom", "0");
    params.set("skipTo", "1200");
    params.set("minSecondary", "1");
    return `web.html?${params.toString()}`;
  }

  $("aiGuideForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!$("aiConsent").checked) return;
    const { ordered, allowed, blocked, namesHeld } = buildSuggestions();
    renderChips(ordered);
    const topPrimary = allowed[0] || "";
    const secondary = allowed.slice(1, 18);
    const webUrl = buildWebUrl(allowed);
    const domain = $("aiDomain").value;
    const summaryLines = [
      "עיון AI מונחה - גל עיני",
      "",
      `תחום: ${$("aiDomain").selectedOptions[0]?.textContent || ""}`,
      `שאלה מנחה: ${$("aiTopic").value.trim()}`,
      "",
      "מילת חיפוש ראשית מומלצת:",
      topPrimary || "לא נבחרה מילה",
      "",
      "מילים משניות מומלצות:",
      secondary.join("\n"),
      "",
      "מילים נוספות להרחבה:",
      allowed.slice(18).join("\n"),
      "",
    ];
    if (domain === "case" || domain === "missing") {
      summaryLines.push("שמות שהוזנו:");
      summaryLines.push(namesHeld.length ? namesHeld.join("\n") : "לא הוזנו שמות.");
      if (domain === "case") summaryLines.push("השמות אינם מדורגים, אינם נבחרים כמילה ראשית, ואינם מסקנה על חשד או אשמה.");
      if (domain === "missing") summaryLines.push("השמות אינם קביעה על מיקום. הם נשמרים כרקע לעיון בלבד, והחיפוש נבנה סביב מקומות, זמנים וסימנים.");
      summaryLines.push("");
    }
    summaryLines.push(
      "דרך עבודה מומלצת:",
      "1. להתחיל במילה הראשית עם 5-8 מילים משניות.",
      "2. אם אין תוצאה, להחליף מילה ראשית מתוך הרשימה העליונה.",
      "3. לבדוק קצה חוט בלבד: שם, מקום, זמן, מסמך, דרך או סימן.",
      "4. אין להסיק אשמה, פסול או הכרעה על אדם מתוך צופן."
    );
    if (domain === "case") summaryLines.push("5. במקרה פלילי: רק גורמי חקירה מוסמכים יכולים לברר חשד מעשי; כאן מתקבל כיוון טקסטואלי בלבד.");
    if (domain === "missing") summaryLines.push("5. במקרה נעדר בזמן אמת: לפנות מיד למשטרה, הצלה או גורמי חיפוש מוסמכים; כאן מתקבלים כיווני עיון בלבד ולא מיקום ודאי.");
    summaryLines.push("", "הערה: זהו כלי עזר לעיון בלבד, ללא הכרעה על אדם וללא לשון הרע.");
    $("aiBlockedWords").textContent = blocked.length ? blocked.join(", ") : "לא סוננו מילים.";
    $("aiSummary").value = summaryLines.join("\n");
    $("openWebSearchButton").href = webUrl;
    $("openWebSearchButton").classList.remove("disabled");
    $("openWebSearchButton").removeAttribute("aria-disabled");
    $("copyAiWordsButton").disabled = !allowed.length;
    $("aiStatus").textContent = `נבנתה רשימה מדורגת של ${allowed.length} מילים מותרות לעיון.`;
    const store = readStore();
    store.aiGuides = Array.isArray(store.aiGuides) ? store.aiGuides : [];
    store.aiGuides.push({
      domain: $("aiDomain").value,
      topic: $("aiTopic").value.trim(),
      words: allowed,
      blocked,
      namesHeld,
      primary: topPrimary,
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
