(() => {
  const DRIVER_KEY = "gal-einai-rides-v2";
  const REQUEST_KEY = "gal-einai-ride-requests-v1";
  const MESSAGE_KEY = "gal-einai-ride-messages-v1";
  const FEEDBACK_KEY = "gal-einai-ride-feedback-v1";
  const SECURITY_REPORT_KEY = "gal-einai-ride-security-reports-v1";
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
      appendText(item, "small", `${request.from} ← ${request.to}`);
      appendText(item, "small", reputationText(request.name, "passenger"));
      if (request.securityHold) appendText(item, "small", `בדיקה חריגה: ${request.securityReason}`);
      appendText(item, "small", request.items ? `חפצים / סימנים: ${request.items}` : "חפצים / סימנים: לא צוין");
      appendText(item, "small", request.shareContact ? "הרשאת קשר: מותר לחשוף לאחר אישור הדדי" : "הרשאת קשר: דרך האתר בלבד");
      appendText(item, "small", request.notes ? `הערה: ${request.notes}` : `התאמות שנמצאו: ${request.matchCount}`);
      box.appendChild(item);
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
        genderMatches(driver.gender, request.gender) &&
        frequencyMatches(driver.frequency || "once", request.frequency) &&
        driver.seats >= request.passengers &&
        details.ok
      );
    });
  }

  $("driverForm").addEventListener("submit", (event) => {
    event.preventDefault();
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
    const request = getRequestFromForm();
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
  renderFeedbackSummary();
})();
