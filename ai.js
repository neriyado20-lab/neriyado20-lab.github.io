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
  ];
  const PLACE_WORDS = [
    "ירושלים", "בני ברק", "צפת", "טבריה", "חברון", "ביתר", "בית שמש", "מודיעין", "אלעד", "אשדוד", "אשקלון",
    "תל אביב", "חיפה", "נתניה", "פתח תקוה", "לוד", "רמלה", "באר שבע", "אילת", "שומרון", "יהודה", "גליל",
    "גולן", "עמק", "הר", "נחל", "ים", "יער", "שדה", "רחוב", "בית", "בנין", "תחנה", "כביש", "צומת", "שער",
    "מערה", "קבר", "ישיבה", "בית כנסת", "מקוה", "חצר", "חדר", "כניסה", "עיר", "כפר", "מושב"
  ];
  const PLACE_TYPE_WORDS = ["עיר", "כפר", "קבוץ", "קיבוץ", "רחוב", "מקום", "בית", "בנין", "שכונה", "מושב", "צומת", "דרך", "כביש", "תחנה", "חצר", "חדר", "כניסה"];
  const CASE_PLACE_WORDS = [
    "מחסן", "חניון", "מקלט", "מרתף", "גג", "חצר", "שדה", "יער", "נחל", "ואדי", "מערה", "בור",
    "באר", "אתר בניה", "מבנה נטוש", "חורבה", "מפעל", "מוסך", "תחנת דלק", "תחנה מרכזית", "תחנת רכבת",
    "מקלט", "מכולה", "קרוואן", "סמטה", "מעבר", "גשר", "מנהרה", "חוף", "ים", "נמל", "פרדס",
    "מטע", "בית קברות", "קבר", "מקוה", "ישיבה", "בית כנסת", "מלון", "דירה", "משרד", "חנות"
  ];
  const TIME_WORDS = ["תשפ", "תש", "ניסן", "אייר", "סיון", "תמוז", "אב", "אלול", "תשרי", "חשון", "כסלו", "טבת", "שבט", "אדר", "יום", "חודש", "שנה", "שעה", "בוקר", "ערב", "לילה"];
  const EVENT_WORDS = ["מלחמה", "שלום", "ישועה", "גאולה", "ניצחון", "פגיעה", "אובדן", "מציאה", "חיפוש", "נסיעה", "נפילה", "עליה", "הצלה", "רפואה", "פריצה", "שריפה", "גשם"];
  let decodeActualScanReady = false;
  const OBJECT_WORDS = ["רכב", "טלפון", "מסמך", "תיק", "בגד", "כסף", "מפתח", "דלת", "חלון", "מכתב", "ספר", "מים", "אש", "אבן", "דרך", "סימן", "עקבות"];
  const PERSON_TYPE_WORDS = ["איש", "אשה", "אדם", "שם", "בן", "בת", "אב", "אם", "רב", "כהן", "לוי", "מלך", "שר", "עד", "חשוד", "חבר"];
  const TIME_TYPE_WORDS = ["זמן", "יום", "חודש", "שנה", "שעה", "תאריך", "מועד", "בוקר", "ערב", "לילה", "תקופה"];
  const TRAIT_WORDS = ["צדיק", "חכם", "ישר", "טוב", "נאמן", "חזק", "חלש", "קדוש", "ענו", "רחמן", "אמיץ", "זהיר", "נקי", "שמח", "עצוב", "גדול", "קטן"];
  const DESCRIPTION_TYPE_WORDS = ["תכונה", "מידה", "סימן", "תיאור", "צבע", "גודל", "מצב", "דרך", "סיבה", "תוצאה", "פעולה", "כיוון"];
  const PERSON_NAME_WORDS = ["משה", "אהרן", "דוד", "שלמה", "יוסף", "יעקב", "יצחק", "אברהם", "שמואל", "שאול", "אליהו", "אלישע", "יהושע", "מרים", "שרה", "רבקה", "רחל", "לאה", "אסתר", "רות", "חיים", "נריה", "ישראל", "יהודה", "בנימין"];
  const TABLE_ROWS = 75;
  const TABLE_EXTRA_COLS = 70;
  const TABLE_MAX_COLS = 260;
  const MAX_TABLE_WORD_LENGTH = 14;
  const TABLE_DIRECTIONS = [
    { dr: 0, dc: 1, label: "אופקי" },
    { dr: 0, dc: -1, label: "אופקי הפוך" },
    { dr: 1, dc: 0, label: "אנכי" },
    { dr: -1, dc: 0, label: "אנכי הפוך" },
    { dr: 1, dc: 1, label: "אלכסון יורד ימינה" },
    { dr: 1, dc: -1, label: "אלכסון יורד שמאלה" },
    { dr: -1, dc: 1, label: "אלכסון עולה ימינה" },
    { dr: -1, dc: -1, label: "אלכסון עולה שמאלה" },
  ];
  let torahTextPromise = null;

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

  function splitLinesOrWords(text) {
    return uniqueWords(String(text || "")
      .split(/[\n,;|]+|\s{2,}/)
      .flatMap((part) => part.trim().includes(" ") ? part.trim().split(/\s+/) : [part.trim()])
      .filter(Boolean));
  }

  function canonical(text) {
    return text.replace(/[^\u0590-\u05ff0-9]/g, "");
  }

  function stripOptionalMatres(text) {
    return canonical(text).replace(/[וי]/g, "");
  }

  function hebrewForms(text) {
    const clean = canonical(text);
    const forms = new Set([clean]);
    if (clean.length > 3 && /^[ובלכמ]/.test(clean)) forms.add(clean.slice(1));
    return Array.from(forms).filter(Boolean);
  }

  function sameAcceptedSpelling(word, term) {
    const termClean = canonical(term);
    if (!termClean) return false;
    return hebrewForms(word).some((form) => (
      form === termClean
      || form.length >= 3 && termClean.length >= 3 && stripOptionalMatres(form) === stripOptionalMatres(termClean)
    ));
  }

  function containsAcceptedTerm(word, term) {
    const clean = canonical(word);
    const termClean = canonical(term);
    if (sameAcceptedSpelling(clean, termClean)) return true;
    return termClean.length >= 4 && clean.includes(termClean);
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

  function inferIntent(question, selected) {
    if (selected && selected !== "auto") return selected;
    const q = canonical(question || "");
    if (/מי|חשוד|חשודים|שם|שמות|אדם|איש|אשה/.test(q)) return "who";
    if (/איפה|היכן|מקום|מקומות|עיר|רחוב|בית|כתובת/.test(q)) return "where";
    if (/מתי|זמן|תאריך|שנה|חודש|יום|שעה/.test(q)) return "when";
    if (/מהקרה|קרה|אירוע|פעולה|סיבה/.test(q)) return "event";
    if (/מה|חפץ|סימן|רכב|טלפון|מסמך|תיק/.test(q)) return "what";
    return "general";
  }

  function looksLikePersonName(word) {
    const clean = canonical(word);
    if (clean.length < 2 || clean.length > 12) return false;
    if ([...PLACE_WORDS, ...CASE_PLACE_WORDS].some((place) => sameAcceptedSpelling(clean, place))) return false;
    if (TIME_WORDS.some((term) => containsAcceptedTerm(clean, term))) return false;
    if (EVENT_WORDS.some((term) => containsAcceptedTerm(clean, term))) return false;
    if (OBJECT_WORDS.some((term) => containsAcceptedTerm(clean, term))) return false;
    return /^[\u0590-\u05ff]+$/.test(clean);
  }

  function isPlaceName(word) {
    return [...PLACE_WORDS, ...CASE_PLACE_WORDS].some((term) => sameAcceptedSpelling(word, term));
  }

  function isPlaceTypeWord(word) {
    return PLACE_TYPE_WORDS.some((term) => sameAcceptedSpelling(word, term));
  }

  function isFromList(word, list) {
    return list.some((term) => containsAcceptedTerm(word, term));
  }

  function relationSignal(pair, label, isSubject, isDescriptor, explanation) {
    const aSubject = isSubject(pair.a.word);
    const bSubject = isSubject(pair.b.word);
    const aDescriptor = isDescriptor(pair.a.word);
    const bDescriptor = isDescriptor(pair.b.word);
    if (!(aSubject && bDescriptor || bSubject && aDescriptor)) return null;
    const subject = aSubject ? pair.a.word : pair.b.word;
    const descriptor = aDescriptor ? pair.a.word : pair.b.word;
    return `${label}: ${subject} ליד/במפגש עם ${descriptor} - ${explanation}`;
  }

  function classifyDecodeWords(words, dates = []) {
    const buckets = {
      people: [],
      places: [],
      times: uniqueWords(dates),
      events: [],
      objects: [],
      other: [],
    };
    uniqueWords(words).forEach((word) => {
      const clean = canonical(word);
      if (!clean) return;
      if (TIME_WORDS.some((term) => containsAcceptedTerm(clean, term)) || /\d{3,4}/.test(word)) buckets.times.push(word);
      else if ([...PLACE_WORDS, ...CASE_PLACE_WORDS].some((term) => sameAcceptedSpelling(clean, term))) buckets.places.push(word);
      else if (EVENT_WORDS.some((term) => containsAcceptedTerm(clean, term))) buckets.events.push(word);
      else if (OBJECT_WORDS.some((term) => containsAcceptedTerm(clean, term))) buckets.objects.push(word);
      else if (looksLikePersonName(word)) buckets.people.push(word);
      else buckets.other.push(word);
    });
    Object.keys(buckets).forEach((key) => { buckets[key] = uniqueWords(buckets[key]); });
    return buckets;
  }

  function intentLabel(intent) {
    return {
      who: "מי / שמות שעלו לעיון",
      where: "איפה / מקומות אפשריים",
      when: "מתי / זמנים ותאריכים",
      what: "מה / חפצים וסימנים",
      event: "מה קרה / אירועים ופעולות",
      general: "כללי",
    }[intent] || "כללי";
  }

  function focusBucketForIntent(intent, buckets) {
    if (intent === "who") return { title: "שמות שעלו לעיון", words: buckets.people, warning: "אין לקרוא לשמות אלו חשודים. הם שמות שעלו בצופן בלבד, וכל שימוש מעשי מחייב בירור חיצוני מוסמך." };
    if (intent === "where") return { title: "מקומות אפשריים שעלו", words: buckets.places, warning: "אין לראות בזה מיקום ודאי. אלו מקומות/רמזי מקום לעיון בלבד." };
    if (intent === "when") return { title: "זמנים ותאריכים שעלו", words: buckets.times, warning: "אין לראות בזה תאריך ודאי. יש לבדוק אם התאריך מופיע בצורה חריגה ומנומקת." };
    if (intent === "what") return { title: "חפצים, סימנים ונושאים שעלו", words: buckets.objects, warning: "אלו סימנים לעיון בלבד, לא הוכחה." };
    if (intent === "event") return { title: "אירועים ופעולות שעלו", words: buckets.events, warning: "אין להסיק שאירוע התרחש או יתרחש מתוך הצופן בלבד." };
    return { title: "מילים מרכזיות שעלו", words: uniqueWords([...buckets.people, ...buckets.places, ...buckets.times, ...buckets.events, ...buckets.objects, ...buckets.other]), warning: "הפענוח כללי וזהיר." };
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

  function wordsForSearch(allowed, namesHeld = []) {
    const primary = allowed[0] || "";
    const primaryKey = canonical(primary);
    const secondaries = uniqueWords([...allowed.slice(1), ...namesHeld])
      .filter((word) => canonical(word) !== primaryKey);
    return primary ? [primary, ...secondaries] : secondaries;
  }

  function buildWebUrl(allowed, namesHeld = []) {
    const searchWords = wordsForSearch(allowed, namesHeld);
    const primary = searchWords[0] || "";
    const secondary = searchWords.slice(1, 19).join(" ");
    const params = new URLSearchParams();
    if (primary) params.set("primary", primary);
    if (secondary) params.set("secondary", secondary);
    params.set("skipFrom", "0");
    params.set("skipTo", "5000");
    params.set("minSecondary", "1");
    return `web.html?${params.toString()}`;
  }

  let lastNamesHeld = [];

  function buildSummaryText(allowed, namesHeld = lastNamesHeld) {
    const searchWords = wordsForSearch(allowed, namesHeld);
    const topPrimary = searchWords[0] || "";
    const secondary = searchWords.slice(1, 19);
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
      searchWords.slice(19).join("\n"),
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
    return summaryLines.join("\n");
  }

  function applyAllowedWords(allowed, namesHeld = []) {
    const words = wordsForSearch(uniqueWords(allowed), namesHeld);
    $("aiSummary").value = buildSummaryText(words, namesHeld);
    $("openWebSearchButton").href = buildWebUrl(words, namesHeld);
    $("openWebSearchButton").classList.toggle("disabled", !words.length);
    if (words.length) $("openWebSearchButton").removeAttribute("aria-disabled");
    else $("openWebSearchButton").setAttribute("aria-disabled", "true");
    $("copyAiWordsButton").disabled = !words.length;
    $("applyAiWordsButton").disabled = !words.length;
    return words;
  }

  function cautionText(level) {
    if (level === "research") return "הניסוח מחקרי: להציג כיווני בדיקה, שאלות פתוחות ומה חסר, בלי מסקנה סופית.";
    if (level === "medium") return "הניסוח בינוני: אפשר להציע כיוון עיון, אך כל משפט מסקנתי חייב הסתייגות.";
    return "הניסוח זהיר מאוד: לכתוב בלשון אפשרות בלבד, בלי קביעה ובלי הכרעה.";
  }

  function buildDecodeText() {
    const title = $("decodeTitle").value.trim() || "צופן ללא כותרת";
    const question = $("decodeQuestion").value.trim();
    const intent = inferIntent(question, $("decodeIntent").value);
    const primary = $("decodePrimary").value.trim();
    const typedSecondaries = splitLinesOrWords($("decodeSecondaries").value);
    const secondaries = decodeActualScanReady ? typedSecondaries : [];
    const dates = splitLinesOrWords($("decodeDates").value);
    const structure = $("decodeStructure").value.trim();
    const context = $("decodeContext").value.trim();
    const caution = $("decodeCaution").value;
    const { allowed: safeSecondaries, blocked } = filterWords(secondaries);
    const { allowed: safeContextWords, blocked: blockedContext } = filterWords(splitWords(context));
    const allBlocked = uniqueWords([...blocked, ...blockedContext]);
    const buckets = classifyDecodeWords(safeSecondaries, dates);
    const focus = focusBucketForIntent(intent, buckets);
    const clusters = safeSecondaries.slice(0, 8);
    const support = safeSecondaries.slice(8, 22);
    const primaryClean = canonical(primary);
    const primaryEcho = safeSecondaries.filter((word) => canonical(word).includes(primaryClean) || primaryClean.includes(canonical(word))).slice(0, 3);

    const lines = [
      "פענוח צופן - גל עיני AI שלב ב",
      "",
      `שם הצופן: ${title}`,
      `שאלה מנחה: ${question || "לא הוזנה"}`,
      `סוג פענוח: ${intentLabel(intent)}`,
      `ראשית: ${primary || "לא הוזנה"}`,
      decodeActualScanReady
        ? "מקור המילים: קובץ צופן נטען וסריקת טבלת דילוג בפועל."
        : "מקור המילים: עדיין לא נטען קובץ צופן לסריקה; מילים שהוקלדו ידנית אינן נחשבות כממצא בפועל.",
      "",
      "המילים לפי סדר עדיפות לפענוח:",
      safeSecondaries.length ? safeSecondaries.map((word) => `- ${word}`).join("\n") : "- לא נמצאו מילים בפועל בסריקת צופן. יש לטעון קובץ צופן או לסרוק טבלת דילוג.",
      "",
      "תאריכים / זמנים:",
      dates.length ? dates.map((word) => `- ${word}`).join("\n") : "- לא הוזנו תאריכים.",
      "",
      `${focus.title}:`,
      focus.words.length ? focus.words.map((word) => `- ${word}`).join("\n") : "- לא זוהו מילים מובהקות בקטגוריה זו.",
      `זהירות: ${focus.warning}`,
      "",
      "סיווג מלא של המילים:",
      `- שמות/אנשים שעלו לעיון: ${buckets.people.join(", ") || "לא זוהו"}`,
      `- מקומות אפשריים: ${buckets.places.join(", ") || "לא זוהו"}`,
      `- זמנים ותאריכים: ${buckets.times.join(", ") || "לא זוהו"}`,
      `- אירועים/פעולות: ${buckets.events.join(", ") || "לא זוהו"}`,
      `- חפצים/סימנים: ${buckets.objects.join(", ") || "לא זוהו"}`,
      "",
      "מבנה וסמיכות:",
      structure || "לא הוזנו הערות מבנה.",
      "",
      "כיוון עיון אפשרי:",
      clusters.length
        ? `בסריקת הצופן בפועל נמצאו סביב הראשית "${primary}" המילים ${clusters.join(", ")}. יש להתייחס לזה ככיוון עיון בלבד, ולבדוק אם הסמיכות, הדילוגים והחזרה של המילים אכן חריגים ביחס לחיפוש רגיל.`
        : "אין מספיק מילים משניות כדי להציע כיוון עיון.",
      "",
      "חיזוקים לבדיקה:",
      support.length ? support.map((word) => `- לבדוק אם "${word}" סמוכה לראשית או למילים המרכזיות.`).join("\n") : "- להוסיף משניות או תאריכים כדי לחזק/להחליש את הכיוון.",
      "",
      "נקודות זהירות:",
      `- ${cautionText(caution)}`,
      "- אין להסיק נבואה, הכרעה מעשית, אשמה, פסול או קביעה על אדם מתוך הצופן.",
      "- אם יש שמות אנשים, יש להשתמש בהם כרקע לעיון בלבד ולא כמסקנה.",
      "- הסיווג נעשה לפי כל המילים שהוזנו או נטענו מהקובץ, ולא רק לפי סימוני צבע בתצוגה.",
      "- לפני פרסום, מומלץ לבדוק תיעוד: צילום, קובץ פרויקט, רשימת דילוגים, והאם נמצאו תוצאות דומות באקראי.",
    ];
    if (primaryEcho.length) {
      lines.splice(15, 0, `יש מילים קרובות לראשית מבחינת כתיב/שורש: ${primaryEcho.join(", ")}. כדאי לבדוק שלא מדובר בכפילות טכנית.`);
    }
    if (context) {
      lines.push("", "רקע שהוזן לעיון:", safeContextWords.length ? safeContextWords.join(", ") : "הרקע נשמר, אך לא חולצו ממנו מילים מותרות.");
    }
    if (allBlocked.length) {
      lines.push("", `מילים שסוננו מטעמי זהירות: ${allBlocked.join(", ")}`);
    }
    return {
      title,
      question,
      intent,
      primary,
      secondaries: safeSecondaries,
      dates,
      buckets,
      focus,
      structure,
      context,
      blocked: allBlocked,
      text: lines.join("\n"),
    };
  }

  function projectWordsFromSaved(saved) {
    const words = [];
    (Array.isArray(saved) ? saved : []).forEach((item) => {
      if (item?.primary?.word) words.push(item.primary.word);
      (Array.isArray(item?.matches) ? item.matches : []).forEach((match) => {
        if (match?.word) words.push(match.word);
      });
    });
    return uniqueWords(words);
  }

  function positionsForProjectMatch(match) {
    const start = Number(match?.start);
    const skip = Number(match?.skip || 1);
    const word = canonical(match?.word || "");
    if (!Number.isFinite(start) || !Number.isFinite(skip) || !word) return [];
    return Array.from({ length: word.length }, (_value, index) => start + index * skip);
  }

  function minPositionDistance(aPositions, bPositions) {
    if (!aPositions.length || !bPositions.length) return Infinity;
    let best = Infinity;
    aPositions.forEach((a) => {
      bPositions.forEach((b) => {
        best = Math.min(best, Math.abs(a - b));
      });
    });
    return best;
  }

  function makeWordStats() {
    const stats = new Map();
    return {
      add(word, options = {}) {
        const key = canonical(word);
        if (!key) return;
        const current = stats.get(key) || {
          word,
          count: 0,
          distance: Infinity,
          sources: new Set(),
        };
        current.word = current.word || word;
        current.count += Number(options.count || 1);
        if (Number.isFinite(options.distance)) current.distance = Math.min(current.distance, options.distance);
        if (options.source) current.sources.add(options.source);
        stats.set(key, current);
      },
      get(word) {
        return stats.get(canonical(word));
      },
      map: stats,
    };
  }

  function orderDecodeWords(words, wordStats, primary) {
    const primaryKey = canonical(primary);
    return uniqueWords(words).sort((a, b) => {
      const aStats = wordStats.get(a) || {};
      const bStats = wordStats.get(b) || {};
      const aCount = aStats.count || 1;
      const bCount = bStats.count || 1;
      if (bCount !== aCount) return bCount - aCount;
      const aDistance = Number.isFinite(aStats.distance) ? aStats.distance : Infinity;
      const bDistance = Number.isFinite(bStats.distance) ? bStats.distance : Infinity;
      if (aDistance !== bDistance) return aDistance - bDistance;
      const aPrimary = primaryKey && (canonical(a).includes(primaryKey) || primaryKey.includes(canonical(a))) ? 1 : 0;
      const bPrimary = primaryKey && (canonical(b).includes(primaryKey) || primaryKey.includes(canonical(b))) ? 1 : 0;
      if (bPrimary !== aPrimary) return bPrimary - aPrimary;
      return a.localeCompare(b, "he");
    });
  }

  function pickPrimaryItem(data, saved, current) {
    const item = saved[current] || saved[0] || {};
    if (item.primary) return item;
    const primary = data.primary && data.primary_start !== undefined
      ? { word: data.primary, start: Number(data.primary_start), skip: Number(data.primary_skip || 1) }
      : null;
    return primary ? { ...item, primary } : item;
  }

  async function loadTorahText() {
    if (!torahTextPromise) {
      torahTextPromise = fetch("assets/torah_clean.txt", { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error("טקסט התורה אינו זמין לסריקת טבלה");
          return response.text();
        })
        .then((text) => text.replace(/[^\u05d0-\u05ea]/g, ""));
    }
    return torahTextPromise;
  }

  function buildTableGrid(primary, torah, skipOverride = null, planeLabel = "") {
    const rawSkip = Number(skipOverride ?? primary?.skip ?? 1) || 1;
    const skipAbs = Math.max(1, Math.abs(rawSkip));
    const cols = Math.min(TABLE_MAX_COLS, Math.max(120, skipAbs + TABLE_EXTRA_COLS));
    const rows = TABLE_ROWS;
    const centerCol = Math.floor(cols / 2);
    const centerRow = Math.floor(rows / 2);
    const start = Number(primary?.start);
    if (!Number.isFinite(start)) return null;
    const base = start - centerRow * skipAbs - centerCol;
    const grid = [];
    for (let row = 0; row < rows; row += 1) {
      const line = [];
      for (let col = 0; col < cols; col += 1) {
        const pos = base + row * skipAbs + col;
        line.push(pos >= 0 && pos < torah.length ? torah[pos] : "");
      }
      grid.push(line);
    }
    return { grid, rows, cols, skipAbs, rawSkip, planeLabel: planeLabel || `מישור ${rawSkip}`, centerRow, centerCol };
  }

  function buildFourScanPlanes(primary, torah) {
    const n = Number(primary?.skip || 1) || 1;
    const planes = [
      { label: `מישור N (${n})`, skip: n },
      { label: `מישור N+1 (${n + 1})`, skip: n + 1 },
      { label: `מישור N-1 (${n - 1})`, skip: n - 1 },
      { label: "מישור 1", skip: 1 },
    ].filter((plane) => plane.skip !== 0);
    return planes.map((plane) => buildTableGrid(primary, torah, plane.skip, plane.label)).filter(Boolean);
  }

  function tableCandidateWords(words) {
    return uniqueWords([
      ...words,
      ...PERSON_NAME_WORDS,
      ...PLACE_WORDS,
      ...CASE_PLACE_WORDS,
      ...PLACE_TYPE_WORDS,
      ...TIME_WORDS,
      ...EVENT_WORDS,
      ...OBJECT_WORDS,
      ...PERSON_TYPE_WORDS,
      ...TIME_TYPE_WORDS,
      ...TRAIT_WORDS,
      ...DESCRIPTION_TYPE_WORDS,
      ...BANK.general,
      ...BANK.case,
      ...BANK.missing,
    ]).map((word) => ({ display: word, clean: canonical(word) }))
      .filter((entry) => entry.clean.length >= 2 && entry.clean.length <= MAX_TABLE_WORD_LENGTH);
  }

  function relevanceWordSet(intent, baseWords) {
    const sets = {
      who: [...PERSON_NAME_WORDS, ...PERSON_TYPE_WORDS],
      where: [...PLACE_WORDS, ...CASE_PLACE_WORDS, ...PLACE_TYPE_WORDS],
      when: [...TIME_WORDS, ...TIME_TYPE_WORDS],
      what: [...OBJECT_WORDS, ...DESCRIPTION_TYPE_WORDS],
      event: [...EVENT_WORDS, ...DESCRIPTION_TYPE_WORDS],
      general: [],
    };
    return new Set(uniqueWords([...(sets[intent] || []), ...baseWords]).map((word) => canonical(word)).filter(Boolean));
  }

  function wordAtGrid(grid, row, col, direction, cellSkip, cleanWord) {
    for (let index = 0; index < cleanWord.length; index += 1) {
      const r = row + direction.dr * cellSkip * index;
      const c = col + direction.dc * cellSkip * index;
      if (!grid[r] || grid[r][c] !== cleanWord[index]) return false;
    }
    return true;
  }

  function scanGridForWords(table, candidates, cellSkips, maxResults = 160) {
    if (!table) return [];
    const found = [];
    const seen = new Set();
    for (const cellSkip of cellSkips) {
      for (const candidate of candidates) {
        for (let row = 0; row < table.rows; row += 1) {
          for (let col = 0; col < table.cols; col += 1) {
            for (const direction of TABLE_DIRECTIONS) {
              if (!wordAtGrid(table.grid, row, col, direction, cellSkip, candidate.clean)) continue;
              const key = `${candidate.clean}|${row}|${col}|${direction.label}|${cellSkip}`;
              if (seen.has(key)) continue;
              seen.add(key);
              found.push({
                word: candidate.display,
                plane: table.planeLabel,
                direction: direction.label,
                cellSkip,
                row: row + 1,
                col: col + 1,
                cells: Array.from({ length: candidate.clean.length }, (_value, index) => ({
                  row: row + direction.dr * cellSkip * index,
                  col: col + direction.dc * cellSkip * index,
                })),
              });
              if (found.length >= maxResults) return found;
            }
          }
        }
      }
    }
    return found;
  }

  function minCellDistance(aCells, bCells) {
    let best = Infinity;
    (aCells || []).forEach((a) => {
      (bCells || []).forEach((b) => {
        best = Math.min(best, Math.abs(a.row - b.row) + Math.abs(a.col - b.col));
      });
    });
    return best;
  }

  function summarizeTableRelations(hits, intent) {
    if (!hits.length) return [];
    const notes = [];
    const byWord = new Map();
    hits.forEach((hit) => {
      const key = canonical(hit.word);
      if (!byWord.has(key)) byWord.set(key, []);
      byWord.get(key).push(hit);
    });
    const repeated = Array.from(byWord.values())
      .filter((items) => items.length > 1)
      .sort((a, b) => b.length - a.length)
      .slice(0, 6)
      .map((items) => `${items[0].word} (${items.length} פעמים)`);
    if (repeated.length) notes.push(`מילים שחזרו יותר מפעם אחת בטבלה: ${repeated.join(", ")}.`);

    const relatedPairs = [];
    for (let i = 0; i < hits.length; i += 1) {
      for (let j = i + 1; j < hits.length; j += 1) {
        if (canonical(hits[i].word) === canonical(hits[j].word)) continue;
        const distance = minCellDistance(hits[i].cells, hits[j].cells);
        if (distance <= 1) {
          relatedPairs.push({
            a: hits[i],
            b: hits[j],
            distance,
            mixedSkip: hits[i].cellSkip !== hits[j].cellSkip,
          });
        }
      }
    }
    relatedPairs.sort((a, b) => a.distance - b.distance || Number(b.mixedSkip) - Number(a.mixedSkip));
    const pairText = relatedPairs.slice(0, 8).map((pair) => (
      `${pair.a.word} + ${pair.b.word} (${pair.distance === 0 ? "מצטלבות" : "נוגעות"}, דילוגי תאים ${pair.a.cellSkip}/${pair.b.cellSkip})`
    ));
    if (pairText.length) notes.push(`קשרי חיזוק בין מילים בטבלה: ${pairText.join("; ")}.`);

    const placeSignals = relatedPairs
      .filter((pair) => (
        isPlaceName(pair.a.word) && isPlaceTypeWord(pair.b.word)
        || isPlaceName(pair.b.word) && isPlaceTypeWord(pair.a.word)
      ))
      .slice(0, 6)
      .map((pair) => {
        const place = isPlaceName(pair.a.word) ? pair.a.word : pair.b.word;
        const type = isPlaceTypeWord(pair.a.word) ? pair.a.word : pair.b.word;
        return `${place} ליד/במפגש עם ${type}`;
      });
    if (placeSignals.length) notes.push(`חיזוק לזיהוי מקום: ${placeSignals.join("; ")}. כאשר שם מקום נפגש או נוגע במילה כמו עיר/כפר/רחוב/מקום, כדאי לציין זאת ככיוון מקום אפשרי.`);

    const semanticSignals = relatedPairs
      .flatMap((pair) => [
        relationSignal(pair, "חיזוק לזיהוי אדם/שם", looksLikePersonName, (word) => isFromList(word, PERSON_TYPE_WORDS), "המילה הסמוכה מתארת אדם או יחס משפחתי/תפקיד"),
        relationSignal(pair, "חיזוק לזיהוי זמן", (word) => isFromList(word, TIME_WORDS) || /\d{3,4}/.test(word), (word) => isFromList(word, TIME_TYPE_WORDS), "המילה הסמוכה מציינת סוג זמן או מועד"),
        relationSignal(pair, "חיזוק לתכונה", (word) => isFromList(word, TRAIT_WORDS), (word) => isFromList(word, DESCRIPTION_TYPE_WORDS), "התכונה סמוכה למילת תיאור/מידה"),
        relationSignal(pair, "חיזוק לתיאור מבוקש", (word) => isFromList(word, OBJECT_WORDS) || isFromList(word, EVENT_WORDS), (word) => isFromList(word, DESCRIPTION_TYPE_WORDS), "המילה סמוכה למילת תיאור כללית"),
      ])
      .filter(Boolean)
      .slice(0, 10);
    if (semanticSignals.length) notes.push(`חיזוקים לפי סוג העניין המבוקש: ${semanticSignals.join("; ")}.`);

    const focus = focusBucketForIntent(intent || "general", classifyDecodeWords(hits.map((hit) => hit.word)));
    if (focus.words.length) {
      notes.push(`קשר לשאלה המנחה: נמצאו מילים שמתאימות ל"${intentLabel(intent || "general")}": ${focus.words.slice(0, 8).join(", ")}.`);
    }
    notes.push("החיזוק נמדד לפי ריבוי הופעות, קרבה לראשית, הצטלבות/נגיעה, וחזרה בדילוגי תאים שונים; עדיין אין בזה הוכחה סטטיסטית בפני עצמה.");
    return notes;
  }

  async function tableWordsFromProject(data, item, baseWords, intent = "general") {
    if (!item?.primary?.word || item.primary.start === undefined || item.primary.skip === undefined) {
      return { words: [], hits: [], notes: ["לא נמצאה ראשית עם מיקום ודילוג לשחזור טבלת הדילוג."] };
    }
    try {
      const torah = await loadTorahText();
      const tables = buildFourScanPlanes(item.primary, torah);
      const candidates = tableCandidateWords(baseWords)
        .filter((entry) => canonical(entry.display) !== canonical(item.primary.word));
      const relevantSet = relevanceWordSet(intent, baseWords);
      const hitsByPlane = tables.flatMap((table) => scanGridForWords(table, candidates, [1], 160).map((hit) => ({
        ...hit,
        distance: Math.abs(hit.row - 1 - table.centerRow) + Math.abs(hit.col - 1 - table.centerCol),
        tableRows: table.rows,
        tableCols: table.cols,
        tableSkip: table.rawSkip,
      })));
      const counts = hitsByPlane.reduce((acc, hit) => {
        const key = canonical(hit.word);
        acc.set(key, (acc.get(key) || 0) + 1);
        return acc;
      }, new Map());
      const hits = hitsByPlane
        .sort((a, b) => {
          const aRel = relevantSet.has(canonical(a.word)) ? 1 : 0;
          const bRel = relevantSet.has(canonical(b.word)) ? 1 : 0;
          if (bRel !== aRel) return bRel - aRel;
          const aCount = counts.get(canonical(a.word)) || 1;
          const bCount = counts.get(canonical(b.word)) || 1;
          if (bCount !== aCount) return bCount - aCount;
          return a.distance - b.distance;
        })
        .slice(0, 80);
      const words = uniqueWords(hits.map((hit) => hit.word));
      const details = hits.slice(0, 18).map((hit) => (
        `${hit.word} - ${hit.plane}, ${hit.direction}, שורה ${hit.row}, עמודה ${hit.col}`
      ));
      const planeNames = tables.map((table) => table.planeLabel).join(", ");
      const tableRows = Math.max(...tables.map((table) => table.rows));
      const tableCols = Math.max(...tables.map((table) => table.cols));
      return {
        words,
        hits,
        notes: [
          `נסרקו ארבעת מישורי הדילוג המחייבים בלבד: ${planeNames}.`,
          `אפשרות א': תחילה נסרק מאגר מילים משמעותיות, ורק אחר כך הממצאים דורגו לפי קשר לשאלה המנחה וקבוצות מילים רלוונטיות.`,
          `כל מישור נסרק בטווח מורחב סביב הראשית: עד ${tableRows} שורות על ${tableCols} עמודות, כמו זום-אאוט גדול.`,
          hits.length ? `נמצאו ${hits.length} התאמות במישורי N, N+1, N-1, 1.` : "לא נמצאו התאמות מספיקות בארבעת המישורים.",
          hits.length < 8 ? "שלב המשך אפשרי: סריקה רחבה בכל דילוג, רק בבחירה מפורשת, משום שזה אובר-הד גדול." : "",
          details.length ? `פירוט ממצאים מהטבלה: ${details.join("; ")}` : "",
          ...summarizeTableRelations(hits, intent),
        ].filter(Boolean),
      };
    } catch (error) {
      return { words: [], hits: [], notes: [`סריקת טבלת הדילוג לא הושלמה: ${error.message}`] };
    }
  }

  async function fillDecodeFromProject(data, fileName = "קובץ צופן") {
    if (!data || typeof data !== "object") throw new Error("קובץ הצופן אינו תקין");
    const saved = Array.isArray(data.saved) ? data.saved : [];
    const current = Math.max(0, Math.min(Number.parseInt(data.current, 10) || 0, Math.max(0, saved.length - 1)));
    const item = pickPrimaryItem(data, saved, current);
    const primary = item.primary?.word || data.primary || "";
    const matches = Array.isArray(item.matches) ? item.matches : [];
    const fieldWords = uniqueWords([
      ...splitWords(data.primary || ""),
      ...splitWords(data.secondary || ""),
    ]);
    const savedWords = projectWordsFromSaved(saved);
    const currentWords = uniqueWords(matches
      .filter((match) => match && match.word)
      .map((match) => match.word));
    const wordStats = makeWordStats();
    const primaryPositions = positionsForProjectMatch(item.primary);
    (Array.isArray(saved) ? saved : []).forEach((savedItem) => {
      (Array.isArray(savedItem?.matches) ? savedItem.matches : []).forEach((match) => {
        const distance = minPositionDistance(primaryPositions, positionsForProjectMatch(match));
        wordStats.add(match.word, { source: "ממצאים שמורים", distance });
      });
    });
    matches.forEach((match) => {
      const distance = minPositionDistance(primaryPositions, positionsForProjectMatch(match));
      wordStats.add(match.word, { source: "הממצא הנוכחי", distance, count: 2 });
    });
    const secondaries = uniqueWords([
      ...savedWords,
      ...currentWords,
    ]).filter((word) => canonical(word) !== canonical(primary));
    if (!$("decodeQuestion").value.trim()) $("decodeQuestion").value = "מה אפשר ללמוד מהמילים שעלו בצופן?";
    const intent = inferIntent($("decodeQuestion").value, $("decodeIntent").value);
    const scanCandidates = uniqueWords([...fieldWords, ...secondaries]);
    const tableScan = await tableWordsFromProject(data, item, scanCandidates, intent);
    tableScan.hits.forEach((hit) => wordStats.add(hit.word, { source: "טבלת דילוג", distance: hit.distance }));
    const allSecondaries = orderDecodeWords([...secondaries, ...tableScan.words], wordStats, primary)
      .filter((word) => canonical(word) !== canonical(primary));
    const dates = allSecondaries.filter((word) => /תש|תמוז|אב|אלול|ניסן|אייר|סיון|טבת|שבט|אדר|חשון|כסלו|\d{4}/.test(word));
    $("decodeTitle").value = data.name || data.title || fileName.replace(/\.(gal_einai\.)?json$/i, "");
    $("decodePrimary").value = primary;
    $("decodeSecondaries").value = allSecondaries.join("\n");
    $("decodeDates").value = dates.join("\n");
    $("decodeStructure").value = [
      saved.length ? `בקובץ יש ${saved.length} ממצאים שמורים.` : "",
      fieldWords.length ? `בשדות החיפוש היו ${fieldWords.length} מילים; הן שימשו כמועמדות לסריקה בלבד ולא נכנסו לפענוח אם לא נמצאו בפועל.` : "",
      savedWords.length ? `נאספו ${savedWords.length} מילים מכל הממצאים השמורים בקובץ, לא רק מהמסומן בצבע בממצא הנוכחי.` : "",
      allSecondaries.length ? "סדר המילים לפענוח נקבע לפי ריבוי הופעות תחילה, אחר כך קירבה לראשית, ואחר כך סדר לשוני." : "",
      item.primary?.skip ? `דילוג ראשית: ${Math.abs(item.primary.skip)}` : "",
      matches.length ? `בממצא הנוכחי ${matches.length} סימונים/מילים.` : "",
      tableScan.words.length ? `נוספו ${tableScan.words.length} מילים מסריקת טבלת הדילוג עצמה, כולל אלכסונים.` : "",
      ...tableScan.notes,
    ].filter(Boolean).join("\n");
    decodeActualScanReady = true;
    $("decodeStatus").textContent = `נטען קובץ צופן: ${fileName}`;
  }

  function buildDecodePrompt(payload) {
    return [
      "אתה מסייע בפענוח זהיר של צופן תורה לאחר סריקה בפועל.",
      "כללים מחייבים:",
      "1. אין לקבוע נבואה, ודאות, אשמה, פסול או הכרעה על אדם.",
      "2. יש לנסח בלשון אפשרות: ייתכן, אפשר לעיין, טעון בדיקה.",
      "3. יש להפריד בין נתונים שנמצאו לבין פרשנות.",
      "4. יש לציין מה חסר לבדיקה: דילוגים, מרחקים, צילום, קובץ פרויקט, השוואת אקראיות.",
      "5. אסור להוסיף מילה שלא מופיעה ברשימת המשניות/המבנה שנמסרה כאן.",
      "6. אם חסרים ממצאים, אמור זאת במפורש במקום להשלים לבד.",
      "",
      `שם הצופן: ${payload.title}`,
      `שאלה מנחה: ${payload.question || "לא הוזנה"}`,
      `סוג פענוח: ${intentLabel(payload.intent)}`,
      `ראשית: ${payload.primary}`,
      `משניות: ${payload.secondaries.join(", ")}`,
      `תאריכים: ${payload.dates.join(", ") || "לא הוזנו"}`,
      `שמות/אנשים שעלו לעיון: ${payload.buckets.people.join(", ") || "לא זוהו"}`,
      `מקומות אפשריים: ${payload.buckets.places.join(", ") || "לא זוהו"}`,
      `זמנים: ${payload.buckets.times.join(", ") || "לא זוהו"}`,
      `אירועים/פעולות: ${payload.buckets.events.join(", ") || "לא זוהו"}`,
      `חפצים/סימנים: ${payload.buckets.objects.join(", ") || "לא זוהו"}`,
      `מבנה: ${payload.structure || "לא הוזן"}`,
      `רקע: ${payload.context || "לא הוזן"}`,
      "",
      "בנה פענוח עברי מסודר בארבעה חלקים: נתונים, כיוון עיון, בדיקות המשך, הסתייגויות."
    ].join("\n");
  }

  function saveDecode(payload) {
    const store = readStore();
    store.aiDecodes = Array.isArray(store.aiDecodes) ? store.aiDecodes : [];
    store.aiDecodes.push({
      title: payload.title,
      question: payload.question,
      intent: payload.intent,
      primary: payload.primary,
      secondaries: payload.secondaries,
      dates: payload.dates,
      buckets: payload.buckets,
      blocked: payload.blocked,
      at: new Date().toISOString(),
    });
    writeStore(store);
    window.GalEinaiBackend?.submit?.("ai_guide", {
      kind: "decode",
      title: payload.title,
      question: payload.question,
      intent: payload.intent,
      primary: payload.primary,
      secondaries: payload.secondaries,
      dates: payload.dates,
      buckets: payload.buckets,
      text: payload.text,
      blocked: payload.blocked,
    }).catch(() => {});
  }

  $("aiGuideForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!$("aiConsent").checked) return;
    const { ordered, allowed, blocked, namesHeld } = buildSuggestions();
    lastNamesHeld = namesHeld;
    const searchWords = wordsForSearch(allowed, namesHeld);
    renderChips(searchWords);
    const topPrimary = searchWords[0] || "";
    $("aiBlockedWords").textContent = blocked.length ? blocked.join(", ") : "לא סוננו מילים.";
    $("aiEditableWords").value = searchWords.join("\n");
    applyAllowedWords(searchWords, namesHeld);
    $("aiStatus").textContent = `נבנתה רשימה מדורגת של ${searchWords.length} מילים מותרות לעיון, כולל שמות כמישניות.`;
    const store = readStore();
    store.aiGuides = Array.isArray(store.aiGuides) ? store.aiGuides : [];
    store.aiGuides.push({
      domain: $("aiDomain").value,
      topic: $("aiTopic").value.trim(),
      words: searchWords,
      blocked,
      namesHeld,
      primary: topPrimary,
      at: new Date().toISOString(),
    });
    writeStore(store);
  });

  $("applyAiWordsButton").addEventListener("click", () => {
    const { allowed, blocked } = filterWords(splitWords($("aiEditableWords").value));
    $("aiEditableWords").value = allowed.join("\n");
    renderChips(allowed);
    $("aiBlockedWords").textContent = blocked.length ? blocked.join(", ") : "לא סוננו מילים.";
    const words = applyAllowedWords(allowed);
    $("aiStatus").textContent = `הרשימה עודכנה לפי בחירת המשתמש: ${words.length} מילים מותרות לעיון.`;
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

  function setDecodeLoading(isLoading, message = "") {
    const loading = $("decodeLoading");
    const button = $("decodeSubmitButton");
    if (loading) {
      loading.hidden = !isLoading;
      if (message) {
        const spinner = loading.querySelector("span");
        loading.textContent = "";
        if (spinner) loading.appendChild(spinner);
        loading.append(` ${message}`);
      }
    }
    if (button) button.disabled = Boolean(isLoading);
    $("aiDecodeForm")?.classList.toggle("is-loading", Boolean(isLoading));
  }

  function setupSpeechButtons() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const buttons = Array.from(document.querySelectorAll("[data-speech-target]"));
    if (!buttons.length) return;
    if (!SpeechRecognition) {
      buttons.forEach((button) => {
        button.disabled = true;
        button.title = "הדפדפן אינו תומך בהכתבה קולית";
      });
      return;
    }
    let activeRecognition = null;
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const field = $(button.dataset.speechTarget);
        if (!field) return;
        if (activeRecognition) activeRecognition.stop();
        const recognition = new SpeechRecognition();
        activeRecognition = recognition;
        recognition.lang = "he-IL";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        button.classList.add("is-listening");
        const statusTarget = field.id.startsWith("decode") ? $("decodeStatus") : $("aiStatus");
        if (statusTarget) statusTarget.textContent = "מאזין... אמור את המילים בעברית.";
        recognition.onresult = (event) => {
          const transcript = Array.from(event.results || [])
            .map((result) => result[0]?.transcript || "")
            .join(" ")
            .trim();
          if (!transcript) return;
          const separator = field.tagName === "TEXTAREA" && field.value.trim() ? "\n" : field.value.trim() ? " " : "";
          field.value = `${field.value}${separator}${transcript}`;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          if (statusTarget) statusTarget.textContent = `נקלט בהכתבה: ${transcript}`;
        };
        recognition.onerror = () => {
          if (statusTarget) statusTarget.textContent = "ההכתבה לא נקלטה. אפשר לנסות שוב או להקליד ידנית.";
        };
        recognition.onend = () => {
          button.classList.remove("is-listening");
          if (activeRecognition === recognition) activeRecognition = null;
        };
        recognition.start();
      });
    });
  }

  function isPaymentRequiredError(error) {
    const text = String(error?.message || error || "").toLowerCase();
    return text.includes("insufficient_quota")
      || text.includes("quota")
      || text.includes("billing")
      || text.includes("תשלום")
      || text.includes("קרדיט")
      || text.includes("מכסה");
  }

  function openPaymentForAi() {
    window.location.assign("purchase.html?source=ai_decode&reason=quota");
  }

  function selectedAiSource() {
    return document.querySelector("input[name='decodeAiSource']:checked")?.value || "site";
  }

  async function privateOpenAiDecode(payload, prompt) {
    const key = $("privateOpenAiKey")?.value.trim();
    if (!key) throw new Error("בחרת מפתח פרטי, אבל לא הוזן מפתח OpenAI.");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        input: [
          "אתה מסייע בפענוח זהיר של צופן תורה לאחר סריקה בפועל.",
          "התייחס רק למילים ולנתונים שנמסרו. אל תוסיף מילה שלא נמצאה בפועל.",
          prompt,
          "",
          "נתוני פענוח:",
          JSON.stringify({
            title: payload.title,
            question: payload.question,
            intent: payload.intent,
            primary: payload.primary,
            secondaries: payload.secondaries,
            dates: payload.dates,
            buckets: payload.buckets,
            structure: payload.structure,
            context: payload.context,
          }, null, 2),
        ].join("\n"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || "OpenAI לא החזיר תשובה תקינה";
      const code = data?.error?.code || "";
      throw new Error(code ? `${message} (${code})` : message);
    }
    return data.output_text
      || (Array.isArray(data.output)
        ? data.output.flatMap((item) => Array.isArray(item.content) ? item.content : [])
          .map((content) => content.text || content.output_text || "")
          .filter(Boolean)
          .join("\n")
        : "");
  }

  function setupAiSourceOptions() {
    const privateRow = $("privateAiKeyRow");
    const update = () => {
      if (privateRow) privateRow.hidden = selectedAiSource() !== "private";
    };
    document.querySelectorAll("input[name='decodeAiSource']").forEach((input) => {
      input.addEventListener("change", update);
    });
    update();
  }

  $("aiDecodeForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!$("decodeConsent").checked) return;
    setDecodeLoading(true, "סורק את הצופן ומפעיל AI חי על הממצאים שנמצאו בפועל. נא להמתין עד לסיום.");
    $("decodeStatus").textContent = "הפענוח בעבודה...";
    $("decodeOutput").value = "";
    $("decodePrompt").value = "";
    $("copyDecodeButton").disabled = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const payload = buildDecodeText();
      const prompt = buildDecodePrompt(payload);
      $("decodePrompt").value = prompt;
      let outputText = payload.text;
      const aiSource = selectedAiSource();
      if (aiSource !== "none" && payload.secondaries.length) {
        $("decodeStatus").textContent = aiSource === "private"
          ? "AI חי במפתח הפרטי שלך מנתח את תיק הממצאים..."
          : "AI חי של גל עיני מנתח את תיק הממצאים שנמצא בסריקה...";
        try {
          let liveText = "";
          if (aiSource === "private") {
            liveText = await privateOpenAiDecode(payload, prompt);
          } else if (window.GalEinaiBackend?.aiDecode) {
            const live = await window.GalEinaiBackend.aiDecode({
              title: payload.title,
              question: payload.question,
              intent: payload.intent,
              primary: payload.primary,
              secondaries: payload.secondaries,
              dates: payload.dates,
              buckets: payload.buckets,
              structure: payload.structure,
              context: payload.context,
              prompt,
            });
            liveText = live?.text || "";
          } else {
            throw new Error("AI של האתר עדיין לא מחובר. אפשר לבחור מפתח OpenAI פרטי או לנסות מאוחר יותר.");
          }
          if (liveText) {
            outputText = [
              payload.text,
              "",
              aiSource === "private"
                ? "ניתוח AI חי במפתח הפרטי שלך על סמך הממצאים שנמצאו בפועל:"
                : "ניתוח AI חי של גל עיני על סמך הממצאים שנמצאו בפועל:",
              liveText,
            ].join("\n");
          }
        } catch (error) {
          if (aiSource === "site" && isPaymentRequiredError(error)) {
            $("decodeStatus").textContent = "נדרש תשלום/קרדיט להפעלת AI חי. מועבר לחלון התשלום...";
            setTimeout(openPaymentForAi, 900);
          }
          outputText = [
            payload.text,
            "",
            aiSource === "site" && isPaymentRequiredError(error)
              ? "הערת מערכת: פענוח AI חי דורש הפעלת תשלום/קרדיט. לאחר השלמת התשלום אפשר לחזור וללחוץ שוב על פענח צופן."
              : aiSource === "private" && isPaymentRequiredError(error)
                ? "הערת מערכת: המפתח הפרטי הגיע למכסת שימוש/חיוב בחשבון OpenAI שלך. אפשר להסדיר זאת בחשבון שלך או לבחור AI של גל עיני דרך האתר."
              : `הערת מערכת: פענוח AI חי לא הושלם כרגע (${error.message || error}). תיק הממצאים המקומי נשמר, ואפשר להפעיל שוב אחרי חיבור ה-Function.`,
          ].join("\n");
        }
      } else if (!payload.secondaries.length) {
        outputText = [
          payload.text,
          "",
          "הערת מערכת: לא הופעל AI חי כי לא נמצאו מילים בפועל בסריקת הצופן.",
        ].join("\n");
      }
      $("decodeOutput").value = outputText;
      $("copyDecodeButton").disabled = !payload.text;
      $("decodeStatus").textContent = `הפענוח הסתיים. נבנתה תוצאה מסודרת לצופן "${payload.title}".`;
      saveDecode({ ...payload, text: outputText });
    } catch (error) {
      $("decodeStatus").textContent = `לא הצלחתי לבנות פענוח: ${error.message || error}`;
    } finally {
      setDecodeLoading(false);
    }
  });

  $("copyDecodeButton")?.addEventListener("click", async () => {
    const text = [$("decodeOutput").value, "", "בקשה ל-AI מתקדם:", $("decodePrompt").value].join("\n");
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      $("decodeStatus").textContent = "הפענוח הועתק.";
    } catch {
      $("decodeOutput").focus();
      $("decodeOutput").select();
      $("decodeStatus").textContent = "אפשר להעתיק ידנית מתיבת הפענוח.";
    }
  });

  $("decodeProjectFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setDecodeLoading(true, "קורא את קובץ הצופן וסורק את טבלת הדילוג...");
      $("decodeStatus").textContent = "קורא את קובץ הצופן וסורק את טבלת הדילוג...";
      await fillDecodeFromProject(JSON.parse(await file.text()), file.name);
    } catch (error) {
      decodeActualScanReady = false;
      $("decodeStatus").textContent = `לא הצלחתי לקרוא את קובץ הצופן: ${error.message}`;
    } finally {
      setDecodeLoading(false);
    }
  });

  setupSpeechButtons();
  setupAiSourceOptions();
})();
