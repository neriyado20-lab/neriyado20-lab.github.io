(() => {
  const DRIVER_KEY = "gal-einai-rides-v2";
  const REQUEST_KEY = "gal-einai-ride-requests-v1";
  const MESSAGE_KEY = "gal-einai-ride-messages-v1";
  const FEEDBACK_KEY = "gal-einai-ride-feedback-v1";
  const SECURITY_REPORT_KEY = "gal-einai-ride-security-reports-v1";
  const COMMUNITY_KEY = "gal-einai-ride-active-community-v1";
  const PARKING_OFFER_KEY = "gal-einai-parking-offers-v1";
  const PARKING_REQUEST_KEY = "gal-einai-parking-requests-v1";
  const PARKING_SCORE_KEY = "gal-einai-parking-scores-v1";
  const PARKING_PREF_KEY = "gal-einai-parking-prefs-v1";
  const $ = (id) => document.getElementById(id);
  let pendingDriverGps = null;

  function normalizePlace(value) {
    return String(value || "")
      .trim()
      .replace(/[״׳"']/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function splitRoute(value) {
    return String(value || "")
      .split(/[\n,;|>]+/)
      .map(normalizePlace)
      .filter(Boolean);
  }

  function readList(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeList(key, list, limit) {
    localStorage.setItem(key, JSON.stringify(list.slice(-limit)));
  }

  function readDrivers() {
    return readList(DRIVER_KEY);
  }

  function writeDrivers(drivers) {
    writeList(DRIVER_KEY, drivers, 80);
  }

  function readRequests() {
    return readList(REQUEST_KEY);
  }

  function writeRequests(requests) {
    writeList(REQUEST_KEY, requests, 120);
  }

  function readMessages() {
    return readList(MESSAGE_KEY);
  }

  function writeMessages(messages) {
    writeList(MESSAGE_KEY, messages, 160);
  }

  function readFeedback() {
    return readList(FEEDBACK_KEY);
  }

  function writeFeedback(feedback) {
    writeList(FEEDBACK_KEY, feedback, 240);
  }

  function readSecurityReports() {
    return readList(SECURITY_REPORT_KEY);
  }

  function writeSecurityReports(reports) {
    writeList(SECURITY_REPORT_KEY, reports, 160);
  }

  function readActiveCommunity() {
    try {
      const data = JSON.parse(localStorage.getItem(COMMUNITY_KEY) || "null");
      return data && data.communityKey ? data : null;
    } catch {
      return null;
    }
  }

  function writeActiveCommunity(community) {
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(community));
  }

  function readParkingOffers() {
    return readList(PARKING_OFFER_KEY);
  }

  function writeParkingOffers(offers) {
    writeList(PARKING_OFFER_KEY, offers, 180);
  }

  function readParkingRequests() {
    return readList(PARKING_REQUEST_KEY);
  }

  function writeParkingRequests(requests) {
    writeList(PARKING_REQUEST_KEY, requests, 180);
  }

  function readParkingScores() {
    return readList(PARKING_SCORE_KEY);
  }

  function writeParkingScores(scores) {
    writeList(PARKING_SCORE_KEY, scores, 300);
  }

  function readParkingPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PARKING_PREF_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function writeParkingPrefs(prefs) {
    localStorage.setItem(PARKING_PREF_KEY, JSON.stringify(prefs));
  }

  function genderMatches(driverGender, requestGender) {
    if (driverGender === "family" || requestGender === "family") return true;
    return driverGender === requestGender;
  }

  function frequencyMatches(driverFrequency, requestFrequency) {
    if (driverFrequency === requestFrequency) return true;
    return driverFrequency === "daily" && requestFrequency === "once";
  }

  function routeMatchDetails(route, from, to) {
    const fromKey = normalizePlace(from);
    const toKey = normalizePlace(to);
    const fromIndex = route.findIndex((stop) => stop.includes(fromKey) || fromKey.includes(stop));
    const toIndex = route.findIndex((stop) => stop.includes(toKey) || toKey.includes(stop));
    return { fromIndex, toIndex, ok: fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex };
  }

  function genderLabel(value) {
    return { men: "גברים בלבד", women: "נשים בלבד", family: "משפחה / בתיאום מיוחד" }[value] || value;
  }

  function frequencyLabel(value) {
    return { once: "חד פעמי", daily: "יומיומי / קבוע" }[value] || value;
  }

  function parkingKindLabel(value) {
    return {
      soon: "חניה ציבורית עומדת להתפנות",
      private: "חניה פרטית פנויה",
      area: "אזור פנוי",
      knowledge: "מידע קבוע על מקום פנוי",
    }[value] || value;
  }

  function parkingTimingLabel(value) {
    return {
      now: "עכשיו",
      3: "בעוד 3 דקות",
      5: "בעוד 5 דקות",
      10: "בעוד 10 דקות",
      later: "מאוחר יותר",
    }[value] || value;
  }

  function parkingUrgencyLabel(value) {
    return { now: "עכשיו", soon: "בזמן הקרוב", later: "בהמשך היום" }[value] || value;
  }

  function parkingVehicleLabel(value) {
    return {
      regular: "רכב רגיל",
      small: "רכב קטן",
      large: "רכב גדול",
      unknown: "לא ידוע",
    }[value] || value;
  }

  function parkingPaymentLabel(value) {
    return { unknown: "תשלום לא ידוע", free: "חינם", paid: "בתשלום" }[value] || value;
  }

  function parkingLimitLabel(value) {
    return {
      unknown: "הגבלת זמן לא ידועה",
      none: "ללא הגבלה ידועה",
      "1h": "עד שעה",
      "2h": "עד שעתיים",
      other: "הגבלה אחרת",
    }[value] || value;
  }

  function parkingPermitLabel(value) {
    return {
      any: "כל חניה",
      unknown: "תו לא ידוע",
      none: "ללא תו ידוע",
      2: "תו 2",
      5: "תו 5",
      disabled: "תו נכה",
      other: "תו אחר",
    }[value] || value;
  }

  function parkingAccuracyLabel(value) {
    return {
      basic: "מידע בסיסי",
      detailed: "מידע מפורט",
      owner: "אושר על ידי בעל המקום",
    }[value] || value;
  }

  function parkingCodeFromId(id) {
    return String(id || "").replace(/\D/g, "").slice(-4).padStart(4, "0");
  }

  function parkingPersonKey(name, phone) {
    return normalizePersonName(`${name || ""} ${phone || ""}`);
  }

  function locationLooksClose(a, b) {
    const left = normalizePlace(a);
    const right = normalizePlace(b);
    if (!left || !right) return false;
    if (left.includes(right) || right.includes(left)) return true;
    const leftParts = left.split(" ").filter((part) => part.length > 1);
    const rightParts = right.split(" ").filter((part) => part.length > 1);
    return leftParts.some((part) => rightParts.includes(part));
  }

  function parkingMatchesRequest(offer, request) {
    const permitOk =
      request.permit === "any" ||
      offer.permit === "unknown" ||
      offer.permit === "none" ||
      offer.permit === request.permit;
    const vehicleOk =
      offer.vehicle === "unknown" ||
      offer.vehicle === "regular" ||
      request.vehicle === "small" ||
      offer.vehicle === request.vehicle;
    return locationLooksClose(offer.location, request.area) && permitOk && vehicleOk;
  }

  function redactedPrivateParkingText(text) {
    const value = String(text || "").trim();
    if (!value) return "אזור כללי לא צוין";
    return value
      .replace(/\b\d+[א-תa-zA-Z]?\b/g, "")
      .replace(/(?:קומה|דירה|כניסה|שער|קוד|עמוד)\s*[:：]?\s*\S+/gi, "")
      .replace(/\s+/g, " ")
      .trim() || "אזור כללי בלבד";
  }

  function publicParkingLocation(offer) {
    if (offer.kind !== "private") return offer.location;
    return `חניה פרטית באזור: ${redactedPrivateParkingText(offer.location)}. כתובת מדויקת נמסרת רק לאחר אישור פרטי וסמוך לזמן.`;
  }

  function publicParkingDetails(offer) {
    if (!offer.details) return "";
    if (offer.kind !== "private") return offer.details;
    return "חניה פרטית: תנאי השימוש נשמרו במערכת, בלי פרסום פרטים מזהים של הבית.";
  }

  function parkingDetailScore(offer) {
    let points = 1;
    if (offer.details) points += 1;
    if (offer.payment !== "unknown") points += 1;
    if (offer.limit !== "unknown") points += 1;
    if (offer.permit !== "unknown") points += 1;
    if (offer.from || offer.until) points += 1;
    if (offer.accuracy === "detailed") points += 1;
    if (offer.accuracy === "owner") points += 2;
    return points;
  }

  function addParkingScore(name, phone, points, reason) {
    const cleanName = String(name || "").trim() || "משתמש";
    const scores = readParkingScores();
    scores.push({
      id: `parking-score-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: cleanName,
      phone: String(phone || "").trim(),
      personKey: parkingPersonKey(cleanName, phone),
      points,
      reason,
      at: new Date().toISOString(),
    });
    writeParkingScores(scores);
  }

  function reserveParkingOffer(offerCode) {
    const offers = readParkingOffers();
    const offer = offers.find((item) => item.code === offerCode);
    if (!offer) {
      $("parkingStatus").textContent = "דיווח החניה כבר אינו נמצא במכשיר זה.";
      return;
    }
    if (offer.reservedAt) {
      $("parkingStatus").textContent = "החניה כבר סומנה כמבוקשת והוסרה מפרסום פעיל.";
      renderParkingOffers();
      return;
    }
    const name = window.prompt("שם המבקש, כדי לשמור את החניה ולא להציג אותה לאחרים:");
    if (!name || !name.trim()) return;
    offer.reservedBy = name.trim();
    offer.reservedAt = new Date().toISOString();
    writeParkingOffers(offers);
    addParkingScore(name.trim(), "", 1, "אישור רצון בחניה והפסקת פרסום פעיל.");
    $("parkingConfirmCode").value = offer.code;
    $("parkingConfirmerName").value = name.trim();
    $("parkingConfirmResult").value = "parked";
    $("parkingStatus").textContent = `דיווח ${offer.code} שוריין עבור ${name.trim()} והוסר מהרשימה הפעילה.`;
    renderParkingOffers();
    renderParkingRequests();
    renderParkingScores();
  }

  function gpsLabel(gps) {
    if (!gps) return "GPS: לא אומת";
    const accuracy = Number.isFinite(gps.accuracy) ? `דיוק כ-${Math.round(gps.accuracy)} מטר` : "דיוק לא ידוע";
    const time = gps.at ? new Date(gps.at).toLocaleString("he-IL") : "זמן לא ידוע";
    return `GPS: אומת נקודתית | ${accuracy} | ${time}`;
  }

  function appendText(parent, tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  function securityFlags(text) {
    const value = String(text || "").toLowerCase();
    const terms = [
      "טרור", "מחבל", "פיגוע", "נשק", "מטען", "חבלה", "ירי", "אלימות",
      "נקמה", "גבול", "בסיס", "תחנת כוח", "מקום רגיש",
    ];
    return terms.filter((term) => value.includes(term));
  }

  function recentCount(items, personKey, minutes = 20) {
    const since = Date.now() - minutes * 60 * 1000;
    return items.filter((item) => {
      const key = normalizePersonName(`${item.name || ""} ${item.phone || ""}`);
      const time = item.at ? new Date(item.at).getTime() : 0;
      return key === personKey && time >= since;
    }).length;
  }

  function reviewReasonForRide(entry, existingItems) {
    const flags = securityFlags([
      entry.name, entry.phone, entry.time, entry.car, entry.from, entry.to,
      entry.items, entry.notes, Array.isArray(entry.route) ? entry.route.join(" ") : "",
    ].join(" "));
    const key = normalizePersonName(`${entry.name || ""} ${entry.phone || ""}`);
    const tooMany = recentCount(existingItems, key) >= 4;
    if (flags.length) return `נעצר לבדיקה בגלל ביטוי חריג: ${flags.slice(0, 3).join(", ")}`;
    if (tooMany) return "נעצר לבדיקה בגלל ריבוי פעולות בזמן קצר.";
    return "";
  }

  function normalizePersonName(value) {
    return String(value || "")
      .trim()
      .replace(/[״׳"']/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function communityKey(value) {
    return normalizePersonName(value);
  }

  function communityLabel(entry) {
    if (!entry?.communityName) return "קהילה: לא צוינה";
    return entry.contactPerson
      ? `קהילה: ${entry.communityName} | איש קשר: ${entry.contactPerson}`
      : `קהילה: ${entry.communityName}`;
  }

  function requireCommunity() {
    const community = readActiveCommunity();
    if (community) return community;
    $("ridesStatus").textContent = "לפני רישום נסיעה יש להפעיל מעגל קהילתי עם שם משתמש וקוד אישי.";
    $("communityStatus").textContent = "לא נבחרה קהילה פעילה. יש להזין קוד אישי שניתן על ידי נציג מוסמך.";
    return null;
  }

  function renderCommunityStatus() {
    const box = $("communityStatus");
    if (!box) return;
    const community = readActiveCommunity();
    if (!community) {
      box.textContent = "לא נבחרה קהילה פעילה.";
      return;
    }
    box.textContent = `קהילה פעילה: ${community.communityName}. משתמש: ${community.userName}. איש קשר: ${community.contactPerson}. קוד התקבל באמצעות ${community.sourceLabel}.`;
  }

  function roleLabel(value) {
    return { driver: "מסיע", passenger: "נוסע" }[value] || value;
  }

  function ratingValue(id) {
    const value = Number.parseInt($(id).value, 10);
    if (!Number.isFinite(value)) return 5;
    return Math.min(5, Math.max(1, value));
  }

  function reputationText(name, role) {
    const key = `${role}:${normalizePersonName(name)}`;
    const items = readFeedback().filter((item) => item.targetKey === key);
    if (items.length < 3) return "מדד אמינות: נאספים משובים, עדיין אין מדד ציבורי.";
    const average = items.reduce((sum, item) => sum + item.average, 0) / items.length;
    return `מדד אמינות ואווירה: ${average.toFixed(1)} מתוך 5 לפי ${items.length} משובים. אינדיקציה בלבד.`;
  }

  function renderFeedbackSummary() {
    const box = $("feedbackSummaryList");
    if (!box) return;
    const feedback = readFeedback();
    box.replaceChildren();
    if (!feedback.length) {
      box.textContent = "אין עדיין משובים שמורים במכשיר זה.";
      return;
    }
    const grouped = new Map();
    feedback.forEach((item) => {
      if (!grouped.has(item.targetKey)) {
        grouped.set(item.targetKey, {
          name: item.targetName,
          role: item.targetRole,
          count: 0,
          sum: 0,
        });
      }
      const group = grouped.get(item.targetKey);
      group.count += 1;
      group.sum += item.average;
    });
    Array.from(grouped.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "he"))
      .forEach((group) => {
        const item = document.createElement("article");
        item.className = "rides-item";
        appendText(item, "strong", `${group.name} - ${roleLabel(group.role)}`);
        if (group.count < 3) {
          appendText(item, "span", `נאספו ${group.count} משובים. עדיין אין מדד ציבורי עד 3 משובים לפחות.`);
        } else {
          appendText(item, "span", `מדד מצטבר: ${(group.sum / group.count).toFixed(1)} מתוך 5`);
          appendText(item, "small", `${group.count} משובים. אינדיקציה קהילתית בלבד, לא קביעה על אדם.`);
        }
        box.appendChild(item);
      });
  }

  function buildDriverItem(driver, { matchText = "", action = true } = {}) {
    const item = document.createElement("article");
    item.className = "rides-item";
    appendText(item, "strong", driver.name);
    appendText(item, "span", `${genderLabel(driver.gender)} | ${frequencyLabel(driver.frequency || "once")} | ${driver.time} | ${driver.seats} מקומות`);
    appendText(item, "small", communityLabel(driver));
    appendText(item, "small", driver.car ? `רכב / סימן: ${driver.car}` : "רכב / סימן: לא צוין");
    appendText(item, "small", gpsLabel(driver.gps));
    appendText(item, "small", reputationText(driver.name, "driver"));
    if (driver.securityHold) appendText(item, "small", `בדיקה חריגה: ${driver.securityReason}`);
    appendText(item, "small", driver.shareContact ? "הרשאת קשר: מותר לחשוף לאחר אישור הדדי" : "הרשאת קשר: דרך האתר בלבד");
    appendText(item, "small", driver.route.join(" ← "));
    if (matchText) appendText(item, "small", matchText);
    if (action && !driver.securityHold) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary";
      button.textContent = "בקש להצטרף למסלול";
      button.addEventListener("click", () => prepareRequestFromDriver(driver));
      item.appendChild(button);
    }
    return item;
  }

  function prepareRequestFromDriver(driver) {
    $("requestGender").value = driver.gender === "family" ? "family" : driver.gender;
    $("requestFrequency").value = driver.frequency || "once";
    $("requestTime").value = driver.time;
    $("requestFrom").focus();
    $("ridesStatus").textContent = `נבחר מסיע: ${driver.name}. מלא מוצא ויעד מתוך המסלול, ואז שמור ובדוק התאמות.`;
  }

  function renderDrivers() {
    const box = $("driverList");
    const drivers = readDrivers();
    box.replaceChildren();
    if (!drivers.length) {
      box.textContent = "אין עדיין מסיעים שמורים במכשיר זה.";
      return;
    }
    drivers.slice().reverse().forEach((driver) => {
      box.appendChild(buildDriverItem(driver));
    });
  }

  function renderRequests() {
    const box = $("requestList");
    const requests = readRequests();
    box.replaceChildren();
    if (!requests.length) {
      box.textContent = "אין עדיין נוסעים שמורים ביומן.";
      return;
    }
    requests.slice().reverse().slice(0, 20).forEach((request) => {
      const item = document.createElement("article");
      item.className = "rides-item";
      appendText(item, "strong", request.name);
      appendText(item, "span", `${genderLabel(request.gender)} | ${frequencyLabel(request.frequency)} | ${request.time} | ${request.passengers} נוסעים`);
      appendText(item, "small", communityLabel(request));
      appendText(item, "small", `${request.from} ← ${request.to}`);
      appendText(item, "small", reputationText(request.name, "passenger"));
      if (request.securityHold) appendText(item, "small", `בדיקה חריגה: ${request.securityReason}`);
      appendText(item, "small", request.items ? `חפצים / סימנים: ${request.items}` : "חפצים / סימנים: לא צוין");
      appendText(item, "small", request.shareContact ? "הרשאת קשר: מותר לחשוף לאחר אישור הדדי" : "הרשאת קשר: דרך האתר בלבד");
      appendText(item, "small", request.notes ? `הערה: ${request.notes}` : `התאמות שנמצאו: ${request.matchCount}`);
      box.appendChild(item);
    });
  }

  function buildParkingOfferItem(offer, requests = readParkingRequests()) {
    const item = document.createElement("article");
    item.className = "rides-item rides-parking-item";
    const matchingRequests = requests.filter((request) => parkingMatchesRequest(offer, request));
    appendText(item, "strong", `${parkingKindLabel(offer.kind)} | דיווח ${offer.code}`);
    appendText(item, "span", publicParkingLocation(offer));
    appendText(item, "small", `${parkingTimingLabel(offer.timing)}${offer.from ? ` | החל מ: ${offer.from}` : ""}${offer.until ? ` | עד: ${offer.until}` : ""}`);
    appendText(item, "small", `${parkingVehicleLabel(offer.vehicle)} | ${parkingPaymentLabel(offer.payment)} | ${parkingLimitLabel(offer.limit)} | ${parkingPermitLabel(offer.permit)}`);
    appendText(item, "small", `${parkingAccuracyLabel(offer.accuracy)} | התאמות לבקשות: ${matchingRequests.length}`);
    const visibleDetails = publicParkingDetails(offer);
    if (visibleDetails) appendText(item, "small", visibleDetails);
    appendText(item, "small", `דווח על ידי ${offer.reporterName} | ${new Date(offer.at).toLocaleString("he-IL")}`);

    const actions = document.createElement("div");
    actions.className = "rides-item-actions";
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "button secondary";
    confirmButton.textContent = "חניתי בזכות זה";
    confirmButton.addEventListener("click", () => {
      $("parkingConfirmCode").value = offer.code;
      $("parkingConfirmResult").value = "parked";
      $("parkingConfirmerName").focus();
    });
    actions.appendChild(confirmButton);

    if (!offer.reservedAt) {
      const reserveButton = document.createElement("button");
      reserveButton.type = "button";
      reserveButton.className = "button primary";
      reserveButton.textContent = "אני רוצה את החניה";
      reserveButton.addEventListener("click", () => reserveParkingOffer(offer.code));
      actions.appendChild(reserveButton);
    }

    const wazeButton = document.createElement("button");
    wazeButton.type = "button";
    wazeButton.className = "button secondary";
    wazeButton.textContent = "פתח ניווט";
    wazeButton.disabled = offer.kind === "private";
    wazeButton.addEventListener("click", () => {
      if (offer.kind === "private") {
        $("parkingStatus").textContent = "בחניה פרטית אין פתיחת ניווט ציבורית לפני אישור פרטי, כדי שלא לפרסם בית פנוי.";
        return;
      }
      window.open(`https://waze.com/ul?q=${encodeURIComponent(offer.location)}&navigate=yes`, "_blank", "noopener");
    });
    actions.appendChild(wazeButton);
    item.appendChild(actions);
    return item;
  }

  function renderParkingOffers() {
    const box = $("parkingOfferList");
    if (!box) return;
    const allOffers = readParkingOffers();
    const offers = allOffers.filter((offer) => !offer.reservedAt);
    const requests = readParkingRequests();
    box.replaceChildren();
    if (!offers.length) {
      const reservedCount = allOffers.length - offers.length;
      box.textContent = reservedCount
        ? `אין כרגע דיווחי חניה פעילים. ${reservedCount} דיווחים כבר שוריינו או ירדו מפרסום.`
        : "אין עדיין דיווחי חניה שמורים במכשיר זה.";
      return;
    }
    offers.slice().reverse().slice(0, 30).forEach((offer) => {
      box.appendChild(buildParkingOfferItem(offer, requests));
    });
  }

  function renderParkingRequests() {
    const box = $("parkingRequestList");
    if (!box) return;
    const requests = readParkingRequests();
    const offers = readParkingOffers();
    box.replaceChildren();
    if (!requests.length) {
      box.textContent = "אין עדיין בקשות חניה שמורות במכשיר זה.";
      return;
    }
    requests.slice().reverse().slice(0, 30).forEach((request) => {
      const matches = offers.filter((offer) => parkingMatchesRequest(offer, request));
      const item = document.createElement("article");
      item.className = "rides-item rides-parking-item";
      appendText(item, "strong", request.name);
      appendText(item, "span", request.area);
      appendText(item, "small", `דחיפות: ${parkingUrgencyLabel(request.urgency)} | ${parkingVehicleLabel(request.vehicle)} | ${parkingPermitLabel(request.permit)}`);
      appendText(item, "small", request.alert === "ring" ? "מבקש צלצול מיוחד כשנמצאת חניה קרובה." : "מבקש התראה שקטה.");
      appendText(item, "small", `נמצאו ${matches.length} דיווחים קרובים במכשיר זה.`);
      box.appendChild(item);
    });
  }

  function renderParkingScores() {
    const box = $("parkingScoreList");
    if (!box) return;
    const scores = readParkingScores();
    box.replaceChildren();
    if (!scores.length) {
      box.textContent = "עדיין אין ניקוד חניה.";
      return;
    }
    const grouped = new Map();
    scores.forEach((score) => {
      const key = score.personKey || parkingPersonKey(score.name, score.phone);
      if (!grouped.has(key)) grouped.set(key, { name: score.name, points: 0, count: 0, lastReason: "" });
      const group = grouped.get(key);
      group.points += Number(score.points) || 0;
      group.count += 1;
      group.lastReason = score.reason || group.lastReason;
    });
    Array.from(grouped.values())
      .sort((a, b) => b.points - a.points || b.count - a.count || a.name.localeCompare(b.name, "he"))
      .slice(0, 20)
      .forEach((group) => {
        const item = document.createElement("article");
        item.className = "rides-item";
        appendText(item, "strong", `${group.name} | ${group.points} נקודות`);
        appendText(item, "small", `${group.count} פעולות שאושרו. ${group.lastReason}`);
        box.appendChild(item);
      });
  }

  function restoreParkingPrefs() {
    const prefs = readParkingPrefs();
    Object.entries({
      parkingReporterName: prefs.name,
      parkingReporterPhone: prefs.phone,
      parkingVehicle: prefs.vehicle,
      parkingPayment: prefs.payment,
      parkingLimit: prefs.limit,
      parkingPermit: prefs.permit,
    }).forEach(([id, value]) => {
      const input = $(id);
      if (input && value) input.value = value;
    });
  }

  function renderMessages() {
    const box = $("messageList");
    const messages = readMessages();
    box.replaceChildren();
    if (!messages.length) {
      box.textContent = "אין עדיין הודעות באתר.";
      return;
    }
    messages.slice().reverse().slice(0, 30).forEach((message) => {
      const item = document.createElement("article");
      item.className = "rides-item";
      appendText(item, "strong", message.title);
      appendText(item, "span", message.body);
      appendText(item, "small", message.contactPolicy);
      appendText(item, "small", new Date(message.at).toLocaleString("he-IL"));
      box.appendChild(item);
    });
  }

  function renderSecurityReports() {
    const box = $("securityReportList");
    if (!box) return;
    const reports = readSecurityReports();
    box.replaceChildren();
    if (!reports.length) {
      box.textContent = "אין דיווחים חריגים שמורים במכשיר זה.";
      return;
    }
    reports.slice().reverse().slice(0, 20).forEach((report) => {
      const item = document.createElement("article");
      item.className = "rides-item";
      appendText(item, "strong", report.title);
      appendText(item, "span", report.details);
      appendText(item, "small", new Date(report.at).toLocaleString("he-IL"));
      box.appendChild(item);
    });
  }

  function getRequestFromForm() {
    return {
      id: `request-${Date.now()}`,
      name: $("requestName").value.trim(),
      phone: $("requestPhone").value.trim(),
      gender: $("requestGender").value,
      frequency: $("requestFrequency").value,
      time: $("requestTime").value.trim(),
      from: $("requestFrom").value.trim(),
      to: $("requestTo").value.trim(),
      passengers: Number.parseInt($("requestPassengers").value, 10) || 1,
      items: $("requestItems").value.trim(),
      notes: $("requestNotes").value.trim(),
      shareContact: $("requestShareContact").checked,
      at: new Date().toISOString(),
    };
  }

  function findMatches(request) {
    return readDrivers().filter((driver) => {
      const details = routeMatchDetails(driver.route, request.from, request.to);
      return (
        !driver.securityHold &&
        !request.securityHold &&
        driver.communityKey &&
        request.communityKey &&
        driver.communityKey === request.communityKey &&
        genderMatches(driver.gender, request.gender) &&
        frequencyMatches(driver.frequency || "once", request.frequency) &&
        driver.seats >= request.passengers &&
        details.ok
      );
    });
  }

  $("driverForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const community = requireCommunity();
    if (!community) return;
    const route = splitRoute($("driverRoute").value);
    if (route.length < 2) {
      $("ridesStatus").textContent = "יש להזין לפחות שתי תחנות במסלול המסיע.";
      return;
    }
    const drivers = readDrivers();
    const driverEntry = {
      id: `driver-${Date.now()}`,
      name: $("driverName").value.trim(),
      phone: $("driverPhone").value.trim(),
      gender: $("driverGender").value,
      frequency: $("driverFrequency").value,
      time: $("driverTime").value.trim(),
      car: $("driverCar").value.trim(),
      gps: pendingDriverGps,
      shareContact: $("driverShareContact").checked,
      communityName: community.communityName,
      communityKey: community.communityKey,
      communityUserName: community.userName,
      contactPerson: community.contactPerson,
      route,
      seats: Number.parseInt($("driverSeats").value, 10) || 1,
      at: new Date().toISOString(),
    };
    const securityReason = reviewReasonForRide(driverEntry, drivers);
    if (securityReason) {
      driverEntry.securityHold = true;
      driverEntry.securityReason = securityReason;
    }
    drivers.push(driverEntry);
    writeDrivers(drivers);
    event.target.reset();
    $("driverSeats").value = "1";
    pendingDriverGps = null;
    $("driverGpsStatus").textContent = "לא בוצע אימות מיקום.";
    $("ridesStatus").textContent = securityReason
      ? "המסיע נשמר לבדיקה חריגה ולא יוצג להתאמות עד בירור."
      : "המסיע נוסף לרשימת המסיעים. נוסעים יכולים לבחור אותו מהרשימה.";
    renderDrivers();
  });

  $("verifyDriverGpsButton").addEventListener("click", () => {
    if (!navigator.geolocation) {
      $("driverGpsStatus").textContent = "הדפדפן אינו תומך באימות GPS.";
      return;
    }
    $("driverGpsStatus").textContent = "מבקש הרשאת מיקום...";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pendingDriverGps = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: position.coords.accuracy,
          at: new Date().toISOString(),
        };
        $("driverGpsStatus").textContent = gpsLabel(pendingDriverGps);
      },
      () => {
        pendingDriverGps = null;
        $("driverGpsStatus").textContent = "אימות GPS לא בוצע. אפשר להמשיך, אך המסיע יסומן כלא מאומת.";
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  });

  $("requestForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const community = requireCommunity();
    if (!community) return;
    const request = getRequestFromForm();
    request.communityName = community.communityName;
    request.communityKey = community.communityKey;
    request.communityUserName = community.userName;
    request.contactPerson = community.contactPerson;
    const requests = readRequests();
    const securityReason = reviewReasonForRide(request, requests);
    if (securityReason) {
      request.securityHold = true;
      request.securityReason = securityReason;
      request.matchCount = 0;
      request.matchDriverIds = [];
      requests.push(request);
      writeRequests(requests);
      $("matchList").replaceChildren();
      $("ridesStatus").textContent = "הבקשה נשמרה לבדיקה חריגה ולא תועבר להתאמה אוטומטית עד בירור.";
      renderRequests();
      return;
    }
    const matches = findMatches(request);
    request.matchCount = matches.length;
    request.matchDriverIds = matches.map((driver) => driver.id);
    requests.push(request);
    writeRequests(requests);
    const messages = readMessages();
    matches.forEach((driver) => {
      const bothApproved = Boolean(driver.shareContact && request.shareContact);
      messages.push({
        id: `message-${Date.now()}-${driver.id}`,
        driverId: driver.id,
        requestId: request.id,
        title: `בקשת הצטרפות עבור ${driver.name}`,
        body: `${request.name} מבקש להצטרף מ-${request.from} ל-${request.to} בזמן ${request.time}.`,
        contactPolicy: bothApproved
          ? `שני הצדדים אישרו חשיפת פרטים לאחר אישור הדדי. טלפון מסיע: ${driver.phone}; טלפון נוסע: ${request.phone}.`
          : "ברירת מחדל: אין לחשוף טלפונים. התיאום דרך הודעות האתר, ומנהל הגמ\"ח מתערב רק במקרה חריג.",
        at: new Date().toISOString(),
      });
    });
    writeMessages(messages);

    const box = $("matchList");
    box.replaceChildren();
    $("ridesStatus").textContent = matches.length
      ? `הבקשה נשמרה. נמצאו ${matches.length} התאמות אפשריות למסלול, לאישור הדדי של המסיע והנוסע.`
      : "הבקשה נשמרה ביומן, אך לא נמצאה התאמה במסלולים השמורים במכשיר זה.";
    matches.forEach((driver) => {
      const contactText = driver.shareContact && request.shareContact
        ? `שני הצדדים אישרו חשיפת פרטים לאחר אישור הדדי. טלפון מסיע: ${driver.phone}; טלפון נוסע: ${request.phone}`
        : "פרטי קשר מוסתרים. יש לתאם דרך הודעות האתר; מנהל הגמ\"ח מתערב רק במקרה חריג.";
      box.appendChild(buildDriverItem(driver, {
        action: false,
        matchText: `המסלול כולל את ${request.from} לפני ${request.to}. ${contactText}`,
      }));
    });
    renderRequests();
    renderMessages();
  });

  $("communityAccessForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("communityName").value.trim();
    const code = $("communityAccessCode").value.trim();
    if (code.length < 4) {
      $("communityStatus").textContent = "הקוד האישי קצר מדי. יש להזין קוד שניתן על ידי נציג הקהילה.";
      return;
    }
    const source = $("communityCodeSource");
    writeActiveCommunity({
      communityName: name,
      communityKey: communityKey(name),
      representative: $("communityRepresentative").value.trim(),
      contactPerson: $("communityContactPerson").value.trim(),
      userName: $("communityUserName").value.trim(),
      source: source.value,
      sourceLabel: source.selectedOptions[0].textContent,
      codeHint: code.slice(-2).padStart(code.length, "*"),
      at: new Date().toISOString(),
    });
    event.target.reset();
    $("ridesStatus").textContent = "המעגל הקהילתי הופעל. כעת ההתאמות יוצגו רק בתוך הקהילה הזו.";
    renderCommunityStatus();
    renderDrivers();
    renderRequests();
  });

  $("securityReportForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const reports = readSecurityReports();
    reports.push({
      id: `security-report-${Date.now()}`,
      title: `${$("securityReporterName").value.trim()} | ${$("securityReportType").selectedOptions[0].textContent}`,
      details: $("securityReportDetails").value.trim(),
      at: new Date().toISOString(),
    });
    writeSecurityReports(reports);
    event.target.reset();
    $("ridesStatus").textContent = "הדיווח נשמר לבדיקה חריגה. אם יש חשש מיידי, יש לפנות לגורם מוסמך.";
    renderSecurityReports();
  });

  $("parkingOfferForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const community = readActiveCommunity();
    const offers = readParkingOffers();
    const id = `parking-offer-${Date.now()}`;
    const offer = {
      id,
      code: parkingCodeFromId(id),
      reporterName: $("parkingReporterName").value.trim(),
      reporterPhone: $("parkingReporterPhone").value.trim(),
      kind: $("parkingKind").value,
      location: $("parkingLocation").value.trim(),
      timing: $("parkingTiming").value,
      from: $("parkingFrom").value.trim(),
      until: $("parkingUntil").value.trim(),
      vehicle: $("parkingVehicle").value,
      payment: $("parkingPayment").value,
      limit: $("parkingLimit").value,
      permit: $("parkingPermit").value,
      accuracy: $("parkingAccuracy").value,
      details: $("parkingDetails").value.trim(),
      leavingRide: $("parkingLeavingRide").checked,
      communityName: community?.communityName || "",
      communityKey: community?.communityKey || "",
      at: new Date().toISOString(),
    };
    offers.push(offer);
    writeParkingOffers(offers);
    writeParkingPrefs({
      name: offer.reporterName,
      phone: offer.reporterPhone,
      vehicle: offer.vehicle,
      payment: offer.payment,
      limit: offer.limit,
      permit: offer.permit,
    });
    addParkingScore(offer.reporterName, offer.reporterPhone, parkingDetailScore(offer), "דיווח חניה מפורט נשמר.");
    const matches = readParkingRequests().filter((request) => parkingMatchesRequest(offer, request));
    $("parkingStatus").textContent = `דיווח חניה ${offer.code} נשמר. נמצאו ${matches.length} בקשות קרובות במכשיר זה.`;
    if (offer.leavingRide) {
      $("driverTime").value = offer.from || parkingTimingLabel(offer.timing);
      $("driverRoute").focus();
      $("ridesStatus").textContent = "סומנה יציאה לנסיעה. אפשר לרשום מסלול טרמפ מתאים בטופס המסיע.";
    }
    event.target.reset();
    restoreParkingPrefs();
    renderParkingOffers();
    renderParkingRequests();
    renderParkingScores();
  });

  $("parkingRequestForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const community = readActiveCommunity();
    const request = {
      id: `parking-request-${Date.now()}`,
      name: $("parkingSeekerName").value.trim(),
      phone: $("parkingSeekerPhone").value.trim(),
      area: $("parkingWantedArea").value.trim(),
      urgency: $("parkingUrgency").value,
      permit: $("parkingSeekerPermit").value,
      vehicle: $("parkingSeekerVehicle").value,
      alert: $("parkingAlert").value,
      communityName: community?.communityName || "",
      communityKey: community?.communityKey || "",
      at: new Date().toISOString(),
    };
    const requests = readParkingRequests();
    requests.push(request);
    writeParkingRequests(requests);
    const matches = readParkingOffers().filter((offer) => parkingMatchesRequest(offer, request));
    $("parkingStatus").textContent = matches.length
      ? `הבקשה נשמרה. נמצאו ${matches.length} דיווחי חניה קרובים.`
      : "הבקשה נשמרה. כרגע אין דיווח חניה קרוב במכשיר זה.";
    event.target.reset();
    renderParkingRequests();
    renderParkingOffers();
  });

  $("parkingConfirmForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = $("parkingConfirmCode").value.trim();
    const offer = readParkingOffers().find((item) => item.code === code);
    const confirmerName = $("parkingConfirmerName").value.trim();
    const result = $("parkingConfirmResult").value;
    const details = $("parkingConfirmDetails").value.trim();
    if (!offer) {
      $("parkingStatus").textContent = "לא נמצא דיווח חניה עם המספר שהוזן במכשיר זה.";
      return;
    }
    const reporterPoints = { parked: 8, helpful: 4, update: 2, "not-found": 0 }[result] || 0;
    const confirmerPoints = { parked: 3, helpful: 2, update: 2, "not-found": 1 }[result] || 0;
    if (reporterPoints) addParkingScore(offer.reporterName, offer.reporterPhone, reporterPoints, `אישור לדיווח ${offer.code}: ${$("parkingConfirmResult").selectedOptions[0].textContent}`);
    if (confirmerPoints) addParkingScore(confirmerName, "", confirmerPoints, "אישור תוצאת חניה לטובת דיוק המערכת.");
    $("parkingStatus").textContent = details
      ? `האישור נשמר. ${details}`
      : "האישור נשמר וניקוד החסד עודכן.";
    event.target.reset();
    renderParkingScores();
    renderParkingOffers();
  });

  $("feedbackForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const targetName = $("feedbackName").value.trim();
    const targetRole = $("feedbackTargetRole").value;
    const scores = {
      respect: ratingValue("feedbackRespect"),
      cleanliness: ratingValue("feedbackCleanliness"),
      timing: ratingValue("feedbackTiming"),
      again: ratingValue("feedbackAgain"),
    };
    const average = (scores.respect + scores.cleanliness + scores.timing + scores.again) / 4;
    const feedback = readFeedback();
    feedback.push({
      id: `feedback-${Date.now()}`,
      fromRole: $("feedbackFromRole").value,
      targetRole,
      targetName,
      targetKey: `${targetRole}:${normalizePersonName(targetName)}`,
      scores,
      average,
      privateNote: $("feedbackPrivateNote").value.trim(),
      at: new Date().toISOString(),
    });
    writeFeedback(feedback);
    event.target.reset();
    $("feedbackRespect").value = "5";
    $("feedbackCleanliness").value = "5";
    $("feedbackTiming").value = "5";
    $("feedbackAgain").value = "5";
    $("ridesStatus").textContent = "המשוב נשמר. לציבור יוצג רק מדד מצטבר ועדין, והערות פרטיות נשמרות למקרה חריג בלבד.";
    renderDrivers();
    renderRequests();
    renderFeedbackSummary();
  });

  renderDrivers();
  renderRequests();
  renderMessages();
  renderSecurityReports();
  renderCommunityStatus();
  restoreParkingPrefs();
  renderParkingOffers();
  renderParkingRequests();
  renderParkingScores();
  renderFeedbackSummary();
})();
