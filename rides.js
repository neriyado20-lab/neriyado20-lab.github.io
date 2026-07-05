(() => {
  const DRIVER_KEY = "gal-einai-rides-v2";
  const REQUEST_KEY = "gal-einai-ride-requests-v1";
  const MESSAGE_KEY = "gal-einai-ride-messages-v1";
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
    return { men: "גברים בלבד", women: "נשים בלבד", family: "משפחה / בתיאום אחראי" }[value] || value;
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

  function buildDriverItem(driver, { matchText = "", action = true } = {}) {
    const item = document.createElement("article");
    item.className = "rides-item";
    appendText(item, "strong", driver.name);
    appendText(item, "span", `${genderLabel(driver.gender)} | ${frequencyLabel(driver.frequency || "once")} | ${driver.time} | ${driver.seats} מקומות`);
    appendText(item, "small", driver.car ? `רכב / סימן: ${driver.car}` : "רכב / סימן: לא צוין");
    appendText(item, "small", gpsLabel(driver.gps));
    appendText(item, "small", driver.shareContact ? "הרשאת קשר: מותר לחשוף לאחר אישור אחראי" : "הרשאת קשר: דרך האתר בלבד");
    appendText(item, "small", driver.route.join(" ← "));
    if (matchText) appendText(item, "small", matchText);
    if (action) {
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
      appendText(item, "small", request.items ? `חפצים / סימנים: ${request.items}` : "חפצים / סימנים: לא צוין");
      appendText(item, "small", request.shareContact ? "הרשאת קשר: מותר לחשוף לאחר אישור אחראי" : "הרשאת קשר: דרך האתר בלבד");
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
    drivers.push({
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
    });
    writeDrivers(drivers);
    event.target.reset();
    $("driverSeats").value = "1";
    pendingDriverGps = null;
    $("driverGpsStatus").textContent = "לא בוצע אימות מיקום.";
    $("ridesStatus").textContent = "המסיע נוסף לרשימת המסיעים. נוסעים יכולים לבחור אותו מהרשימה.";
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
    const matches = findMatches(request);
    request.matchCount = matches.length;
    request.matchDriverIds = matches.map((driver) => driver.id);
    const requests = readRequests();
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
          ? `שני הצדדים אישרו חשיפת פרטים לאחר אישור אחראי. טלפון מסיע: ${driver.phone}; טלפון נוסע: ${request.phone}.`
          : "ברירת מחדל: אין לחשוף טלפונים. התיאום דרך האתר ואחראי הגמ\"ח בלבד.",
        at: new Date().toISOString(),
      });
    });
    writeMessages(messages);

    const box = $("matchList");
    box.replaceChildren();
    $("ridesStatus").textContent = matches.length
      ? `הבקשה נשמרה. נמצאו ${matches.length} התאמות אפשריות למסלול, לאישור אחראי הגמ"ח.`
      : "הבקשה נשמרה ביומן, אך לא נמצאה התאמה במסלולים השמורים במכשיר זה.";
    matches.forEach((driver) => {
      const contactText = driver.shareContact && request.shareContact
        ? `שני הצדדים אישרו חשיפת פרטים לאחר בדיקת אחראי. טלפון מסיע: ${driver.phone}; טלפון נוסע: ${request.phone}`
        : "פרטי קשר מוסתרים. יש לתאם דרך האתר ואחראי הגמ\"ח בלבד.";
      box.appendChild(buildDriverItem(driver, {
        action: false,
        matchText: `המסלול כולל את ${request.from} לפני ${request.to}. ${contactText}`,
      }));
    });
    renderRequests();
    renderMessages();
  });

  renderDrivers();
  renderRequests();
  renderMessages();
})();
