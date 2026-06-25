(() => {
  "use strict";

  const TARGET_COUNT = 304805;
  const FREE_MAX_RESULTS = 30;
  const PRO_MAX_RESULTS = 250;
  const DEFAULT_ROWS = 45;
  const DEFAULT_EXTRA_COLS = 10;
  const DRAFT_KEY = "gal-einai-web-draft-v1";
  const LIBRARY_KEY = "gal-einai-web-library-v1";
  const LIBRARY_LIMIT = 20;
  const HISTORY_KEY = "gal-einai-web-history-v1";
  const DISPLAY_CONTROLS_KEY = "gal-einai-web-display-controls-v1";
  const AVOT_SETTINGS_KEY = "gal-einai-web-avot-v1";
  const HISTORY_LIMIT = 20;
  const FREE_MAX_SKIP = 400;
  const PRO_MAX_SKIP = 5000;
  const FREE_MAX_SECONDARIES = 5;
  const PRO_MAX_SECONDARIES = 30;
  const FREE_MAX_PRIMARIES = 1;
  const PRO_MAX_PRIMARIES = 10;
  const pageParams = new URLSearchParams(window.location.search);
  const edition = pageParams.get("edition") === "free" ? "free" : "pro";
  const COLORS = ["#3ddc84", "#42d7f5", "#ffe15c", "#f78acb", "#b9f35d", "#ffb347", "#9db4ff"];

  const state = {
    torah: "",
    verses: [],
    index: new Map(),
    results: [],
    current: 0,
    stop: false,
    searching: false,
    zoom: 24,
    primaryCache: null,
    lineKeys: new Set(),
    activeWordKey: null,
    draggedWordKey: null,
    displayControlsVisible: true,
    avotLines: [],
    avotIndex: 0,
    avotSpeed: 4,
    avotVisible: true,
    avotOrder: "ordered",
    avotPaused: false,
    avotX: 0,
    avotLastFrame: 0,
    avotGroups: [],
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("searchForm"),
    primary: $("primaryInput"),
    secondary: $("secondaryInput"),
    skipFrom: $("skipFromInput"),
    skipTo: $("skipToInput"),
    minSecondary: $("minSecondaryInput"),
    search: $("searchButton"),
    secondaryScan: $("secondaryScanButton"),
    stop: $("stopButton"),
    clear: $("clearButton"),
    openProject: $("openProjectButton"),
    saveProject: $("saveProjectButton"),
    library: $("libraryButton"),
    history: $("historyButton"),
    export: $("exportButton"),
    saveImage: $("saveImageButton"),
    print: $("printButton"),
    projectFile: $("projectFileInput"),
    progress: $("searchProgress"),
    status: $("statusText"),
    count: $("resultCount"),
    summary: $("resultSummary"),
    head: $("resultsHead"),
    body: $("resultsBody"),
    grid: $("torahGrid"),
    title: $("displayTitle"),
    topWords: $("topWords"),
    displayControls: document.querySelector(".display-controls"),
    toggleDisplayControls: $("toggleDisplayControlsButton"),
    toggleDisplayControlsText: $("toggleDisplayControlsText"),
    prev: $("prevResultButton"),
    next: $("nextResultButton"),
    zoomIn: $("zoomInButton"),
    zoomOut: $("zoomOutButton"),
    zoomReset: $("zoomResetButton"),
    scrollRight: $("scrollRightButton"),
    scrollLeft: $("scrollLeftButton"),
    scrollUp: $("scrollUpButton"),
    scrollDown: $("scrollDownButton"),
    editionBadge: $("editionBadge"),
    editionSwitch: $("editionSwitch"),
    editionLimitNote: $("editionLimitNote"),
    libraryDialog: $("libraryDialog"),
    libraryClose: $("closeLibraryButton"),
    libraryForm: $("librarySaveForm"),
    libraryName: $("libraryNameInput"),
    librarySearch: $("librarySearchInput"),
    libraryList: $("libraryList"),
    libraryCount: $("libraryCount"),
    libraryBackup: $("backupLibraryButton"),
    libraryRestore: $("restoreLibraryButton"),
    libraryBackupInput: $("libraryBackupInput"),
    historyDialog: $("historyDialog"),
    historyClose: $("closeHistoryButton"),
    historyClear: $("clearHistoryButton"),
    historyList: $("historyList"),
    historyCount: $("historyCount"),
    exportDialog: $("exportDialog"),
    exportClose: $("closeExportButton"),
    exportCount: $("exportCount"),
    exportSummary: $("exportSummaryText"),
    copySummary: $("copySummaryButton"),
    downloadCsv: $("downloadCsvButton"),
    connectionOverlay: $("connectionOverlay"),
    wordMenu: $("wordMenu"),
    changeWordColor: $("changeWordColorButton"),
    toggleWordLine: $("toggleWordLineButton"),
    removeWord: $("removeWordButton"),
    removeAllWord: $("removeAllWordButton"),
    wordColor: $("wordColorInput"),
    help: $("helpButton"),
    helpDialog: $("helpDialog"),
    helpClose: $("closeHelpButton"),
    helpEdition: $("helpEditionText"),
    tools: $("toolsButton"),
    toolsDialog: $("toolsDialog"),
    toolsClose: $("closeToolsButton"),
    avotTicker: $("avotTicker"),
    avotTrack: $("avotTrack"),
    avotPrev: $("avotPrevButton"),
    avotNext: $("avotNextButton"),
    avotVisible: $("showAvotTickerInput"),
    avotSpeed: $("avotSpeedInput"),
    avotSpeedValue: $("avotSpeedValue"),
    avotOrdered: $("avotOrderedInput"),
    avotRandom: $("avotRandomInput"),
  };

  function applyEdition() {
    document.body.dataset.edition = edition;
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set("edition", edition === "free" ? "pro" : "free");
    els.editionBadge.textContent = edition === "free" ? "חינמית" : "מקצועית | בטא פתוחה";
    els.editionSwitch.textContent = edition === "free" ? "נסה מקצועית" : "עבור לחינמית";
    els.editionSwitch.href = `web.html?${nextParams.toString()}`;
    const maxSkip = edition === "free" ? FREE_MAX_SKIP : PRO_MAX_SKIP;
    const maxSecondaries = edition === "free" ? FREE_MAX_SECONDARIES : PRO_MAX_SECONDARIES;
    els.skipFrom.max = String(maxSkip);
    els.skipTo.max = String(maxSkip);
    els.minSecondary.max = String(maxSecondaries);
    if (edition === "free") {
      els.editionLimitNote.innerHTML = `בחינמית: ראשית אחת, עד ${FREE_MAX_SECONDARIES} משניות, דילוג ${FREE_MAX_SKIP} ו-${FREE_MAX_RESULTS} צפנים בחיפוש. <a href="web.html?edition=pro">ראה את המקצועית</a>.`;
    } else {
      els.editionLimitNote.textContent = `המקצועית: עד ${PRO_MAX_PRIMARIES} ראשיות, ${PRO_MAX_SECONDARIES} משניות, דילוג ${PRO_MAX_SKIP} ו-${PRO_MAX_RESULTS} צפנים בחיפוש. הבטא פתוחה ללא חיוב.`;
    }
    els.helpEdition.textContent = edition === "free"
      ? "הוראות למהדורה החינמית"
      : "הוראות למהדורה המקצועית";
  }

  function normalizeWord(value) {
    return String(value || "")
      .replace(/[^\u05d0-\u05ea?]/g, "")
      .replace(/[ךםןףץ]/g, (ch) => ({ "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }[ch] || ch));
  }

  function splitWords(value, { keepRequired = false } = {}) {
    const seen = new Set();
    const words = [];
    String(value || "").split(/[\s,;|]+/).forEach((raw) => {
      if (!raw) return;
      const required = raw.includes("!");
      const word = normalizeWord(raw.replaceAll("!", ""));
      if (!word) return;
      const key = word;
      if (seen.has(key)) {
        if (required && keepRequired) {
          const existing = words.find((item) => item.word === word);
          if (existing) existing.required = true;
        }
        return;
      }
      seen.add(key);
      words.push(keepRequired ? { word, required } : word);
    });
    return words;
  }

  function stableColor(word) {
    let h = 0;
    for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  }

  function setStatus(text, percent = null) {
    els.status.textContent = text;
    if (percent !== null) els.progress.value = Math.max(0, Math.min(100, percent));
  }

  function setBusy(value) {
    state.searching = value;
    els.search.disabled = value;
    els.secondaryScan.disabled = value;
    els.saveProject.disabled = value;
    els.export.disabled = value;
    els.stop.disabled = !value;
  }

  function applyDisplayControlsVisibility() {
    els.displayControls.hidden = !state.displayControlsVisible;
    els.toggleDisplayControlsText.textContent = state.displayControlsVisible ? "הסתר כלים" : "הצג כלים";
    els.toggleDisplayControls.setAttribute("aria-expanded", String(state.displayControlsVisible));
    try {
      localStorage.setItem(DISPLAY_CONTROLS_KEY, state.displayControlsVisible ? "visible" : "hidden");
    } catch {
      // The current session still keeps the selected layout.
    }
  }

  function toggleDisplayControls() {
    state.displayControlsVisible = !state.displayControlsVisible;
    applyDisplayControlsVisibility();
  }

  function saveAvotSettings() {
    try {
      localStorage.setItem(AVOT_SETTINGS_KEY, JSON.stringify({
        visible: state.avotVisible,
        speed: state.avotSpeed,
        order: state.avotOrder,
      }));
    } catch {
      // The selected settings remain active for the current session.
    }
  }

  function applyAvotSettings() {
    state.avotSpeed = Math.max(1, Math.min(10, Number(state.avotSpeed) || 4));
    state.avotOrder = state.avotOrder === "random" ? "random" : "ordered";
    els.avotTicker.hidden = !state.avotVisible;
    els.avotVisible.checked = state.avotVisible;
    els.avotSpeed.value = String(state.avotSpeed);
    els.avotSpeedValue.textContent = String(state.avotSpeed);
    els.avotOrdered.checked = state.avotOrder === "ordered";
    els.avotRandom.checked = state.avotOrder === "random";
    saveAvotSettings();
  }

  function createAvotGroup(index) {
    const caption = document.createElement("span");
    caption.className = "avot-caption";
    caption.textContent = String(state.avotLines[index] || "").replace(/\s+/g, " ").trim();
    els.avotTrack.appendChild(caption);
    const group = {
      element: caption,
      index,
      x: 0,
      spawnedNext: false,
    };
    state.avotGroups.push(group);
    requestAnimationFrame(() => {
      group.x = -Math.max(1, caption.offsetWidth);
      caption.style.transform = `translateX(${group.x}px)`;
    });
    return group;
  }

  function showAvotLine() {
    if (!state.avotLines.length) return;
    els.avotTrack.replaceChildren();
    state.avotGroups = [];
    createAvotGroup(state.avotIndex % state.avotLines.length);
  }

  function stepAvot(direction) {
    if (!state.avotLines.length) return;
    state.avotIndex = (state.avotIndex + direction + state.avotLines.length) % state.avotLines.length;
    showAvotLine();
  }

  function nextAutomaticAvotIndex(currentIndex = state.avotIndex) {
    const count = state.avotLines.length;
    if (count <= 1) return 0;
    if (state.avotOrder === "random") {
      const offset = 1 + Math.floor(Math.random() * (count - 1));
      return (currentIndex + offset) % count;
    }
    return (currentIndex + 1) % count;
  }

  function avotGapWidth() {
    const probe = document.createElement("canvas");
    const context = probe.getContext("2d");
    const style = getComputedStyle(els.avotTrack);
    context.font = `13px ${style.fontFamily || "Arial"}`;
    return Math.max(90, context.measureText("א".repeat(15)).width);
  }

  function animateAvot(timestamp) {
    if (!state.avotLastFrame) state.avotLastFrame = timestamp;
    const elapsed = Math.min(80, timestamp - state.avotLastFrame);
    state.avotLastFrame = timestamp;
    if (state.avotVisible && !state.avotPaused && state.avotLines.length) {
      const pixelsPerSecond = 10 + state.avotSpeed * 4;
      const delta = (pixelsPerSecond * elapsed) / 1000;
      const gapWidth = avotGapWidth();
      state.avotGroups.slice().forEach((group) => {
        group.x += delta;
        group.element.style.transform = `translateX(${group.x}px)`;
        if (!group.spawnedNext && group.x >= gapWidth) {
          group.spawnedNext = true;
          state.avotIndex = nextAutomaticAvotIndex(group.index);
          createAvotGroup(state.avotIndex);
        }
        if (group.x > els.avotTrack.clientWidth) {
          group.element.remove();
          state.avotGroups = state.avotGroups.filter((item) => item !== group);
        }
      });
    }
    requestAnimationFrame(animateAvot);
  }

  async function loadAvot() {
    try {
      const response = await fetch("assets/pirkei_avot_mishnayot.json", { cache: "force-cache" });
      if (!response.ok) return;
      const data = await response.json();
      state.avotLines = Array.isArray(data) ? data.filter((line) => String(line || "").trim()) : [];
      if (state.avotLines.length) showAvotLine();
    } catch {
      els.avotTicker.hidden = true;
    }
  }

  function serializableMatch(match) {
    return {
      word: match.word,
      start: match.start,
      skip: match.skip,
      kind: match.kind,
      color: match.color || stableColor(match.word),
      positions: Array.isArray(match.positions) ? match.positions : positionsForMatch(match),
    };
  }

  function projectData() {
    return {
      format: "gal_einai_web",
      version: "W029",
      saved_at: new Date().toISOString(),
      primary: els.primary.value.trim(),
      secondary: els.secondary.value.trim(),
      skip_from: Number.parseInt(els.skipFrom.value || "1", 10) || 1,
      skip_to: Number.parseInt(els.skipTo.value || "1", 10) || 1,
      min_secondary: Number.parseInt(els.minSecondary.value || "0", 10) || 0,
      current: state.current,
      saved: state.results.map((result) => ({
        primary: serializableMatch(result.primary),
        matches: result.matches.map(serializableMatch),
      })),
    };
  }

  function saveDraft() {
    if (edition !== "pro") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(projectData()));
    } catch {
      // A downloadable file remains available even when browser storage is blocked.
    }
  }

  function restoreDraft() {
    if (edition !== "pro") return false;
    if (pageParams.has("project")) return false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      loadProjectData(JSON.parse(raw), "העבודה האחרונה בדפדפן");
      return true;
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      return false;
    }
  }

  function safeFileName(value) {
    const name = String(value || "צופן")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return name || "צופן";
  }

  function downloadProject(data, name = data.primary) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(name)}.gal_einai.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function saveProjectFile() {
    if (!state.results.length) {
      setStatus("אין ממצאים לשמירה. יש לבצע חיפוש או לפתוח צופן.", 0);
      return;
    }
    const data = projectData();
    downloadProject(data);
    saveDraft();
    setStatus(`הצופן נשמר | ממצאים ${state.results.length}`, 100);
  }

  function readLibrary() {
    try {
      const items = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
      return Array.isArray(items) ? items.filter((item) => item && item.id && item.data).slice(0, LIBRARY_LIMIT) : [];
    } catch {
      return [];
    }
  }

  function writeLibrary(items) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items.slice(0, LIBRARY_LIMIT)));
  }

  function validLibraryItem(item) {
    return Boolean(
      item
      && typeof item === "object"
      && typeof item.name === "string"
      && item.name.trim()
      && item.data
      && typeof item.data === "object"
      && Array.isArray(item.data.saved)
    );
  }

  function formatSavedDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  function renderLibrary() {
    const items = readLibrary();
    const query = normalizeWord(els.librarySearch.value);
    const visibleItems = query
      ? items.filter((item) => normalizeWord(`${item.name} ${item.data.primary || ""} ${item.data.secondary || ""}`).includes(query))
      : items;
    els.libraryCount.textContent = query
      ? `${visibleItems.length} תוצאות | ${items.length} מתוך ${LIBRARY_LIMIT}`
      : `${items.length} מתוך ${LIBRARY_LIMIT} צפנים`;
    els.libraryList.replaceChildren();
    if (!visibleItems.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = items.length ? "לא נמצאו צפנים מתאימים לחיפוש." : "עדיין לא נשמרו צפנים בספרייה.";
      els.libraryList.appendChild(empty);
      return;
    }
    visibleItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "library-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.name;
      const meta = document.createElement("span");
      const resultCount = Array.isArray(item.data.saved) ? item.data.saved.length : 0;
      meta.textContent = `${formatSavedDate(item.savedAt)} | ${resultCount} ממצאים`;
      info.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "library-actions";
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "פתח";
      openButton.addEventListener("click", () => {
        loadProjectData(item.data, `הספרייה: ${item.name}`);
        els.libraryDialog.close();
      });
      const downloadButton = document.createElement("button");
      downloadButton.type = "button";
      downloadButton.textContent = "הורד";
      downloadButton.addEventListener("click", () => downloadProject(item.data, item.name));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-library-item";
      deleteButton.textContent = "מחק";
      deleteButton.addEventListener("click", () => {
        if (!window.confirm(`למחוק את הצופן "${item.name}" מהספרייה?`)) return;
        writeLibrary(readLibrary().filter((saved) => saved.id !== item.id));
        renderLibrary();
        setStatus(`הצופן "${item.name}" נמחק מהספרייה`, 0);
      });
      actions.append(openButton, downloadButton, deleteButton);
      row.append(info, actions);
      els.libraryList.appendChild(row);
    });
  }

  function openLibrary() {
    if (edition !== "pro") return;
    els.libraryName.value = els.primary.value.trim() || "צופן חדש";
    els.librarySearch.value = "";
    renderLibrary();
    els.libraryDialog.showModal();
    els.libraryName.focus();
    els.libraryName.select();
  }

  function saveToLibrary(event) {
    event.preventDefault();
    if (!state.results.length) {
      setStatus("אין ממצאים לשמירה בספרייה.", 0);
      els.libraryDialog.close();
      return;
    }
    const name = els.libraryName.value.trim() || els.primary.value.trim() || "צופן";
    const items = readLibrary();
    const normalizedName = name.toLocaleLowerCase("he-IL");
    const existingIndex = items.findIndex((item) => item.name.toLocaleLowerCase("he-IL") === normalizedName);
    const savedItem = {
      id: existingIndex >= 0 ? items[existingIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      savedAt: new Date().toISOString(),
      data: projectData(),
    };
    if (existingIndex >= 0) {
      items.splice(existingIndex, 1);
    } else if (items.length >= LIBRARY_LIMIT) {
      setStatus(`הספרייה מלאה. ניתן לשמור עד ${LIBRARY_LIMIT} צפנים.`, 0);
      return;
    }
    items.unshift(savedItem);
    try {
      writeLibrary(items);
      saveDraft();
      renderLibrary();
      setStatus(`הצופן "${name}" נשמר בספרייה`, 100);
    } catch {
      setStatus("אין די מקום בדפדפן לשמירת הצופן. אפשר להוריד אותו כקובץ.", 0);
    }
  }

  function backupLibrary() {
    const items = readLibrary();
    if (!items.length) {
      setStatus("הספרייה ריקה ואין מה לגבות.", 0);
      return;
    }
    const backup = {
      format: "gal_einai_library",
      version: "W029",
      exported_at: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `גל עיני - גיבוי ספרייה ${new Date().toISOString().slice(0, 10)}.gal_einai_library.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`גובו ${items.length} צפנים לקובץ`, 100);
  }

  function mergeLibraryBackup(data) {
    if (!data || data.format !== "gal_einai_library" || !Array.isArray(data.items)) {
      throw new Error("קובץ הגיבוי אינו קובץ ספרייה תקין של גל עיני");
    }
    const imported = data.items.filter(validLibraryItem);
    if (!imported.length) throw new Error("לא נמצאו צפנים תקינים בקובץ הגיבוי");
    const merged = readLibrary();
    let added = 0;
    let updated = 0;
    imported.forEach((rawItem) => {
      const item = {
        id: rawItem.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: rawItem.name.trim().slice(0, 80),
        savedAt: rawItem.savedAt || new Date().toISOString(),
        data: rawItem.data,
      };
      const normalizedName = item.name.toLocaleLowerCase("he-IL");
      const existingIndex = merged.findIndex((saved) => saved.name.toLocaleLowerCase("he-IL") === normalizedName);
      if (existingIndex >= 0) {
        merged.splice(existingIndex, 1);
        updated += 1;
      } else if (merged.length >= LIBRARY_LIMIT) {
        return;
      } else {
        added += 1;
      }
      merged.unshift(item);
    });
    writeLibrary(merged);
    renderLibrary();
    setStatus(`שחזור הושלם | נוספו ${added} | עודכנו ${updated} | בספרייה ${readLibrary().length}`, 100);
  }

  function readHistory() {
    if (edition !== "pro") return [];
    try {
      const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(items) ? items.filter((item) => item && item.id && item.primary).slice(0, HISTORY_LIMIT) : [];
    } catch {
      return [];
    }
  }

  function writeHistory(items) {
    if (edition !== "pro") return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  }

  function historyKey(item) {
    return JSON.stringify({
      primary: String(item.primary || "").trim(),
      secondary: String(item.secondary || "").trim(),
      skipFrom: Number(item.skipFrom) || 1,
      skipTo: Number(item.skipTo) || 1,
      minSecondary: Number(item.minSecondary) || 0,
    });
  }

  function rememberSearch() {
    if (edition !== "pro" || !state.results.length) return;
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      searchedAt: new Date().toISOString(),
      primary: els.primary.value.trim(),
      secondary: els.secondary.value.trim(),
      skipFrom: Number.parseInt(els.skipFrom.value || "1", 10) || 1,
      skipTo: Number.parseInt(els.skipTo.value || "1", 10) || 1,
      minSecondary: Number.parseInt(els.minSecondary.value || "0", 10) || 0,
      resultCount: state.results.length,
    };
    const key = historyKey(item);
    const items = readHistory().filter((saved) => historyKey(saved) !== key);
    items.unshift(item);
    try {
      writeHistory(items);
    } catch {
      // Search completion is not interrupted when browser storage is full.
    }
  }

  function loadHistoryFields(item) {
    els.primary.value = item.primary || "";
    els.secondary.value = item.secondary || "";
    els.skipFrom.value = String(item.skipFrom || 1);
    els.skipTo.value = String(item.skipTo || 1);
    els.minSecondary.value = String(item.minSecondary || 0);
  }

  function renderHistory() {
    const items = readHistory();
    els.historyCount.textContent = `${items.length} מתוך ${HISTORY_LIMIT} חיפושים`;
    els.historyList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = "עדיין לא נשמרו חיפושים מוצלחים.";
      els.historyList.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "library-item history-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.primary;
      const terms = document.createElement("span");
      terms.className = "history-terms";
      terms.textContent = item.secondary || "ללא משניות";
      const meta = document.createElement("span");
      meta.textContent = `${formatSavedDate(item.searchedAt)} | דילוג ${item.skipFrom}-${item.skipTo} | ${item.resultCount} צפנים`;
      info.append(title, terms, meta);

      const actions = document.createElement("div");
      actions.className = "library-actions";
      const loadButton = document.createElement("button");
      loadButton.type = "button";
      loadButton.textContent = "טען";
      loadButton.addEventListener("click", () => {
        loadHistoryFields(item);
        els.historyDialog.close();
        setStatus("תנאי החיפוש נטענו מההיסטוריה", 0);
      });
      const rerunButton = document.createElement("button");
      rerunButton.type = "button";
      rerunButton.textContent = "חפש שוב";
      rerunButton.addEventListener("click", () => {
        loadHistoryFields(item);
        els.historyDialog.close();
        search(null);
      });
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-library-item";
      deleteButton.textContent = "מחק";
      deleteButton.addEventListener("click", () => {
        writeHistory(readHistory().filter((saved) => saved.id !== item.id));
        renderHistory();
      });
      actions.append(loadButton, rerunButton, deleteButton);
      row.append(info, actions);
      els.historyList.appendChild(row);
    });
  }

  function openHistory() {
    if (edition !== "pro") return;
    renderHistory();
    els.historyDialog.showModal();
  }

  function resultWords(result) {
    const words = new Map();
    result.matches.forEach((match) => {
      if (match.kind === "primary") return;
      const key = `${match.word}|${Math.abs(match.skip || 1)}`;
      const current = words.get(key);
      words.set(key, {
        word: match.word,
        skip: Math.abs(match.skip || 1),
        count: (current?.count || 0) + 1,
      });
    });
    return Array.from(words.values());
  }

  function exportSummaryText() {
    const lines = [
      "גל עיני - דוח ממצאים",
      `ראשיות: ${els.primary.value.trim() || "-"}`,
      `משניות: ${els.secondary.value.trim() || "-"}`,
      `טווח דילוגים: ${els.skipFrom.value}-${els.skipTo.value}`,
      `מינימום משניות: ${els.minSecondary.value}`,
      `מספר צפנים: ${state.results.length}`,
      "",
    ];
    state.results.forEach((result, index) => {
      const words = resultWords(result)
        .map((item) => `${item.word} (${item.skip}${item.count > 1 ? ` ×${item.count}` : ""})`)
        .join(", ");
      lines.push(
        `${index + 1}. ראשית: ${result.primary.word} | דילוג: ${Math.abs(result.primary.skip)} | משניות: ${result.secondaryCount} | מיקום: ${result.primary.start + 1}`,
        `   ${words || "ללא משניות"}`,
      );
    });
    return lines.join("\n");
  }

  function csvValue(value) {
    return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  }

  function exportCsvText() {
    const rows = [
      ["מספר", "ראשית", "דילוג ראשית", "מספר משניות", "מיקום", "מילים שנמצאו"],
    ];
    state.results.forEach((result, index) => {
      const words = resultWords(result)
        .map((item) => `${item.word} | דילוג ${item.skip}${item.count > 1 ? ` ×${item.count}` : ""}`)
        .join("; ");
      rows.push([
        index + 1,
        result.primary.word,
        Math.abs(result.primary.skip),
        result.secondaryCount,
        result.primary.start + 1,
        words,
      ]);
    });
    return rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  }

  function openExport() {
    if (edition !== "pro") return;
    if (!state.results.length) {
      setStatus("אין ממצאים לייצוא.", 0);
      return;
    }
    els.exportCount.textContent = `${state.results.length} ממצאים`;
    els.exportSummary.value = exportSummaryText();
    els.exportDialog.showModal();
  }

  async function copyExportSummary() {
    const text = els.exportSummary.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      els.exportSummary.focus();
      els.exportSummary.select();
      document.execCommand("copy");
    }
    setStatus("סיכום הממצאים הועתק", 100);
  }

  function downloadResultsCsv() {
    if (!state.results.length) return;
    const blob = new Blob(["\ufeff", exportCsvText()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(els.primary.value || "ממצאים")} - דוח ממצאים.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`יוצאו ${state.results.length} ממצאים ל-CSV`, 100);
  }

  async function loadTorah() {
    const [response, displayResponse] = await Promise.all([
      fetch("assets/torah_clean.txt", { cache: "force-cache" }),
      fetch("assets/torah_display.txt", { cache: "force-cache" }),
    ]);
    if (!response.ok) throw new Error("לא הצלחתי לטעון את טקסט התורה");
    const raw = await response.text();
    state.torah = raw.replace(/[^\u05d0-\u05ea]/g, "");
    if (displayResponse.ok) {
      buildVerseMap(await displayResponse.text());
    }
    buildIndex();
    const ok = state.torah.length === TARGET_COUNT;
    if (ok) {
      setStatus("", 0);
    } else {
      setStatus(`טקסט התורה נטען, אך האורך אינו צפוי: ${state.torah.length.toLocaleString("he-IL")}`, 0);
    }
  }

  function buildIndex() {
    state.index.clear();
    for (let i = 0; i < state.torah.length; i += 1) {
      const ch = normalizeWord(state.torah[i]);
      if (!state.index.has(ch)) state.index.set(ch, []);
      state.index.get(ch).push(i);
    }
  }

  function checkWordAt(word, start, skip) {
    const n = state.torah.length;
    for (let i = 0; i < word.length; i += 1) {
      const pos = start + i * skip;
      if (pos < 0 || pos >= n) return false;
      const expected = word[i];
      if (expected !== "?" && normalizeWord(state.torah[pos]) !== expected) return false;
    }
    return true;
  }

  function matchPositions(match) {
    const out = [];
    for (let i = 0; i < match.word.length; i += 1) out.push(match.start + i * match.skip);
    return out;
  }

  function buildVerseMap(raw) {
    const verses = [];
    const built = [];
    let book = "";
    let chapter = "";
    let position = 0;
    String(raw || "").split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      const chapterMatch = line.match(/^([א-ת]+)\s+פרק-([א-ת]+)$/);
      if (chapterMatch) {
        [book, chapter] = chapterMatch.slice(1);
        return;
      }
      const parts = line.split(/(\{[א-ת]+\})/);
      let verse = "";
      let buffer = "";
      const flush = () => {
        const letters = buffer.replace(/[\u0591-\u05c7]/g, "").replace(/[^\u05d0-\u05ea]/g, "");
        if (!verse || !letters) return;
        const start = position;
        position += letters.length;
        built.push(letters);
        verses.push({ book, chapter, verse, start, end: position - 1 });
      };
      parts.forEach((part) => {
        const marker = part.trim().match(/^\{([א-ת]+)\}$/);
        if (marker) {
          flush();
          verse = marker[1];
          buffer = "";
        } else {
          buffer += ` ${part}`;
        }
      });
      flush();
    });
    state.verses = built.join("") === state.torah ? verses : [];
  }

  function sppAt(position) {
    let low = 0;
    let high = state.verses.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const verse = state.verses[middle];
      if (position < verse.start) {
        high = middle - 1;
      } else if (position > verse.end) {
        low = middle + 1;
      } else {
        return `${verse.book} ${verse.chapter}:${verse.verse}`;
      }
    }
    return "";
  }

  function positionsForMatch(match) {
    if (Array.isArray(match.positions) && match.positions.length) return match.positions;
    return matchPositions(match);
  }

  async function findWord(word, skips, onProgress) {
    const normalized = normalizeWord(word);
    if (!normalized) return [];
    let anchorIndex = 0;
    let anchorPositions = null;
    let bestSize = Infinity;
    for (let i = 0; i < normalized.length; i += 1) {
      if (normalized[i] === "?") continue;
      const positions = state.index.get(normalized[i]) || [];
      if (positions.length < bestSize) {
        bestSize = positions.length;
        anchorIndex = i;
        anchorPositions = positions;
      }
    }
    if (!anchorPositions) anchorPositions = Array.from({ length: state.torah.length }, (_v, i) => i);
    const total = Math.max(1, skips.length * anchorPositions.length);
    const results = [];
    let done = 0;
    for (const skip of skips) {
      for (const anchorPos of anchorPositions) {
        if (state.stop) return results;
        done += 1;
        const start = anchorPos - anchorIndex * skip;
        const end = start + (normalized.length - 1) * skip;
        if (start >= 0 && start < state.torah.length && end >= 0 && end < state.torah.length && checkWordAt(normalized, start, skip)) {
          results.push({ word: normalized, start, skip, kind: "primary" });
          if (onProgress) onProgress(done, total, results.length, Math.abs(skip));
        } else if (onProgress && done % 3000 === 0) {
          onProgress(done, total, results.length, Math.abs(skip));
        }
      }
      await nextFrame();
    }
    if (onProgress) onProgress(total, total, results.length, Math.abs(skips[skips.length - 1] || 1));
    return results;
  }

  function positionsForPrimary(primary) {
    const skipAbs = Math.max(1, Math.abs(primary.skip || 1));
    const cols = Math.min(180, Math.max(80, skipAbs + DEFAULT_EXTRA_COLS));
    const rows = DEFAULT_ROWS;
    const centerCol = Math.floor(cols / 2);
    const centerRow = Math.floor(rows / 2);
    const base = primary.start - centerRow * skipAbs - centerCol;
    const positions = [];
    const positionSet = new Set();
    for (let r = 0; r < rows; r += 1) {
      const row = [];
      for (let c = 0; c < cols; c += 1) {
        const p = base + r * skipAbs + c;
        row.push(p >= 0 && p < state.torah.length ? p : null);
        if (p >= 0 && p < state.torah.length) positionSet.add(p);
      }
      positions.push(row);
    }
    return { rows, cols, grid: positions, set: positionSet, center: primary.start };
  }

  function findInWindow(word, windowInfo) {
    const skips = [1, -1];
    const primarySkip = Math.max(1, Math.abs(currentPrimarySkip(windowInfo)));
    [primarySkip, -primarySkip, primarySkip + 1, -(primarySkip + 1), primarySkip - 1, -(primarySkip - 1)]
      .filter((s) => s)
      .forEach((s) => {
        if (!skips.includes(s)) skips.push(s);
      });
    const found = [];
    const normalized = normalizeWord(word);
    for (const pos of windowInfo.set) {
      for (const skip of skips) {
        if (!checkWordAt(normalized, pos, skip)) continue;
        const match = { word: normalized, start: pos, skip, kind: "secondary" };
        const allInside = positionsForMatch(match).every((p) => windowInfo.set.has(p));
        if (allInside) found.push(match);
      }
    }
    return dedupeMatches(found);
  }

  function currentPrimarySkip(windowInfo) {
    return windowInfo.primarySkip || 1;
  }

  function dedupeMatches(matches) {
    const seen = new Set();
    const out = [];
    for (const match of matches) {
      const key = `${match.word}|${match.start}|${match.skip}|${match.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(match);
    }
    return out;
  }

  function cleanMatch(raw, fallbackKind = "secondary") {
    if (!raw || typeof raw !== "object") return null;
    const word = normalizeWord(raw.word || "");
    const start = Number.parseInt(raw.start, 10);
    const skip = Number.parseInt(raw.skip, 10) || 1;
    if (!word || !Number.isFinite(start)) return null;
    return {
      word,
      start,
      skip,
      kind: raw.kind || fallbackKind,
      color: raw.color || stableColor(word),
      positions: Array.isArray(raw.positions) ? raw.positions.filter((p) => Number.isFinite(Number(p))).map(Number) : null,
    };
  }

  function countSecondaryWords(matches) {
    const words = new Set();
    matches.forEach((match) => {
      if (match.kind !== "primary") words.add(match.word);
    });
    return words.size;
  }

  function resultFromSavedItem(item) {
    const primary = cleanMatch(item?.primary, "primary");
    if (!primary) return null;
    primary.kind = "primary";
    const matches = dedupeMatches([primary, ...(Array.isArray(item.matches) ? item.matches.map((m) => cleanMatch(m)).filter(Boolean) : [])]);
    const windowInfo = positionsForPrimary(primary);
    windowInfo.primarySkip = primary.skip;
    return {
      primary,
      matches,
      secondaryCount: countSecondaryWords(matches),
      windowInfo,
    };
  }

  function loadProjectData(data, sourceName = "קובץ צופן") {
    if (!data || typeof data !== "object") throw new Error("קובץ הצופן אינו תקין");
    els.primary.value = data.primary || "";
    els.secondary.value = data.secondary || "";
    els.skipFrom.value = data.skip_from ?? els.skipFrom.value;
    els.skipTo.value = data.skip_to ?? els.skipTo.value;
    els.minSecondary.value = data.min_secondary ?? els.minSecondary.value;
    const saved = Array.isArray(data.saved) ? data.saved : [];
    state.results = saved.map(resultFromSavedItem).filter(Boolean).slice(0, PRO_MAX_RESULTS);
    state.current = Math.max(0, Math.min(Number.parseInt(data.current, 10) || 0, Math.max(0, state.results.length - 1)));
    const loadedPrimaryWords = splitWords(els.primary.value);
    const loadedFrom = Math.max(1, Math.abs(Number.parseInt(els.skipFrom.value || "1", 10) || 1));
    const loadedTo = Math.max(loadedFrom, Math.abs(Number.parseInt(els.skipTo.value || String(loadedFrom), 10) || loadedFrom));
    state.primaryCache = state.results.length
      ? { key: primaryCacheKey(loadedPrimaryWords, loadedFrom, loadedTo), matches: state.results.map((result) => result.primary) }
      : null;
    renderResults();
    renderCurrent();
    saveDraft();
    setStatus(`צופן נטען: ${sourceName} | ממצאים ${state.results.length}`, 100);
  }

  async function loadProjectFromUrl(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("לא הצלחתי לטעון את קובץ הצופן");
    const data = await response.json();
    loadProjectData(data, url.split("/").pop() || "צופן מהאתר");
  }

  async function loadProjectFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const project = params.get("project");
    if (!project) return;
    await loadProjectFromUrl(project);
  }

  function requiredCount(secondaries) {
    const total = secondaries.length;
    const required = Math.max(0, Number.parseInt(els.minSecondary.value || "0", 10) || 0);
    return Math.min(total, required);
  }

  function primaryCacheKey(primaryWords, from, to) {
    return JSON.stringify({ primaryWords, from, to });
  }

  async function search(event, { cacheOnly = false } = {}) {
    if (event) event.preventDefault();
    if (!state.torah) return;
    const primaryWords = splitWords(els.primary.value);
    const secondaries = splitWords(els.secondary.value, { keepRequired: true });
    if (!primaryWords.length) {
      setStatus("יש להקליד ראשית לחיפוש", 0);
      return;
    }
    const editionMaxPrimaries = edition === "free" ? FREE_MAX_PRIMARIES : PRO_MAX_PRIMARIES;
    if (primaryWords.length > editionMaxPrimaries) {
      setStatus(
        edition === "free"
          ? `המהדורה החינמית מאפשרת ראשית אחת בחיפוש. המקצועית מאפשרת עד ${PRO_MAX_PRIMARIES} ראשיות במקביל.`
          : `ניתן לחפש עד ${PRO_MAX_PRIMARIES} ראשיות במקביל.`,
        0
      );
      els.primary.focus();
      return;
    }
    const editionMaxSecondaries = edition === "free" ? FREE_MAX_SECONDARIES : PRO_MAX_SECONDARIES;
    if (secondaries.length > editionMaxSecondaries) {
      setStatus(
        edition === "free"
          ? `המהדורה החינמית מאפשרת עד ${FREE_MAX_SECONDARIES} משניות בחיפוש. ניתן לעבור למקצועית לעד ${PRO_MAX_SECONDARIES}.`
          : `ניתן לחפש עד ${PRO_MAX_SECONDARIES} משניות בכל חיפוש.`,
        0
      );
      els.secondary.focus();
      return;
    }
    const from = Math.max(1, Math.abs(Number.parseInt(els.skipFrom.value || "1", 10) || 1));
    const to = Math.max(from, Math.abs(Number.parseInt(els.skipTo.value || String(from), 10) || from));
    const editionMaxSkip = edition === "free" ? FREE_MAX_SKIP : PRO_MAX_SKIP;
    if (from > editionMaxSkip || to > editionMaxSkip) {
      setStatus(
        edition === "free"
          ? `המהדורה החינמית מאפשרת חיפוש עד דילוג ${FREE_MAX_SKIP}. ניתן לעבור למקצועית להמשך הטווח.`
          : `טווח החיפוש המרבי הוא ${PRO_MAX_SKIP}.`,
        0
      );
      els.skipTo.focus();
      return;
    }
    const cacheKey = primaryCacheKey(primaryWords, from, to);
    const resultLimit = edition === "free" ? FREE_MAX_RESULTS : PRO_MAX_RESULTS;
    const hasMatchingCache = state.primaryCache && state.primaryCache.key === cacheKey;
    if (cacheOnly && !hasMatchingCache) {
      setStatus("אין ראשיות מתאימות בזיכרון. יש לבצע תחילה חיפוש ראשיות או לפתוח צופן.", 0);
      return;
    }
    state.stop = false;
    setBusy(true);
    state.results = [];
    state.current = 0;
    renderResults();
    renderEmptyGrid(cacheOnly ? "סורק משניות בראשיות שנשמרו..." : "מחפש...");
    try {
      const skips = [];
      for (let s = from; s <= to; s += 1) {
        skips.push(s, -s);
      }
      let primaries = [];
      if (hasMatchingCache) {
        primaries = state.primaryCache.matches.slice();
        setStatus(`${cacheOnly ? "סורק משניות בלבד" : "משתמש בראשיות מהזיכרון"} | ראשיות ${primaries.length}`, 60);
        await nextFrame();
      } else {
        setStatus("מחפש ראשיות...", 0);
        await nextFrame();
        for (let p = 0; p < primaryWords.length; p += 1) {
          const primaryWord = primaryWords[p];
          const foundForPrimary = await findWord(primaryWord, skips, (done, total, foundCount, skip) => {
            const primaryBase = p / Math.max(1, primaryWords.length);
            const primaryShare = done / Math.max(1, total) / Math.max(1, primaryWords.length);
            const percent = Math.floor((primaryBase + primaryShare) * 60);
            setStatus(`מחפש ראשיות ${p + 1}/${primaryWords.length} | נמצאו ${primaries.length + foundCount} | דילוג ${skip}`, percent);
          });
          primaries.push(...foundForPrimary);
        }
        state.primaryCache = { key: cacheKey, matches: primaries.slice() };
      }
      const total = Math.max(1, primaries.length);
      for (let i = 0; i < primaries.length; i += 1) {
        if (state.stop) break;
        const primaryMatch = primaries[i];
        const activeSecondaries = secondaries.filter((item) => item.word !== primaryMatch.word);
        const minRequired = requiredCount(activeSecondaries);
        const requiredWords = activeSecondaries.filter((item) => item.required).map((item) => item.word);
        const windowInfo = positionsForPrimary(primaryMatch);
        windowInfo.primarySkip = primaryMatch.skip;
        const local = [primaryMatch];
        const foundWords = new Set();
        for (const secondary of activeSecondaries) {
          const matches = findInWindow(secondary.word, windowInfo);
          if (matches.length) foundWords.add(secondary.word);
          local.push(...matches);
        }
        const hasRequired = requiredWords.every((word) => foundWords.has(word));
        if (foundWords.size >= minRequired && hasRequired) {
          state.results.push({
            primary: primaryMatch,
            matches: dedupeMatches(local),
            secondaryCount: foundWords.size,
            windowInfo,
          });
        }
        if (i % 5 === 0) {
          setStatus(`בודק משניות ${i + 1}/${primaries.length} | נשמרו ${state.results.length}`, 60 + Math.floor(((i + 1) / total) * 40));
          await nextFrame();
        }
        if (state.results.length >= resultLimit) break;
      }
      state.results.sort((a, b) => b.secondaryCount - a.secondaryCount || Math.abs(a.primary.skip) - Math.abs(b.primary.skip));
      const limitNotice = state.results.length >= resultLimit ? ` | הוצגו עד ${resultLimit}` : "";
      setStatus(`החיפוש הסתיים | ראשיות ${primaries.length} | צפנים ${state.results.length}${limitNotice}`, 100);
      renderResults();
      renderCurrent();
      saveDraft();
      rememberSearch();
    } catch (error) {
      setStatus(`שגיאה: ${error.message}`, 0);
    } finally {
      setBusy(false);
    }
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function renderResults() {
    els.count.textContent = String(state.results.length);
    els.head.innerHTML = "";
    els.body.innerHTML = "";
    if (!state.results.length) {
      els.summary.textContent = "אין ממצאים להצגה.";
      els.body.appendChild(document.importNode($("emptyResultsTemplate").content, true));
      return;
    }
    const primaryNames = new Set(state.results.map((item) => item.primary.word));
    const skipValues = new Set(state.results.map((item) => Math.abs(item.primary.skip)));
    const showPrimary = primaryNames.size > 1;
    const showSkip = skipValues.size > 1;
    els.summary.textContent = [
      !showPrimary ? `ראשית: ${Array.from(primaryNames)[0]}` : "",
      !showSkip ? `דילוג משותף: ${Array.from(skipValues)[0]}` : "",
    ].filter(Boolean).join(" | ");
    const columns = ["מס'"];
    if (showPrimary) columns.push("ראשית");
    if (showSkip) columns.push("דילוג");
    columns.push("משניות", "מיקום");
    const headRow = document.createElement("tr");
    columns.forEach((name) => {
      const th = document.createElement("th");
      th.textContent = name;
      headRow.appendChild(th);
    });
    els.head.appendChild(headRow);
    state.results.forEach((result, index) => {
      const tr = document.createElement("tr");
      tr.className = index === state.current ? "active" : "";
      tr.addEventListener("click", () => {
        state.current = index;
        renderResults();
        renderCurrent();
      });
      const values = [String(index + 1)];
      if (showPrimary) values.push(result.primary.word);
      if (showSkip) values.push(String(Math.abs(result.primary.skip)));
      values.push(String(result.secondaryCount), (result.primary.start + 1).toLocaleString("he-IL"));
      values.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      els.body.appendChild(tr);
    });
  }

  function renderCurrent() {
    const current = state.results[state.current];
    if (!current) {
      renderEmptyGrid("אין ממצא להצגה.");
      return;
    }
    const spp = sppAt(current.primary.start);
    els.title.textContent = `טבלה בדילוג ${Math.abs(current.primary.skip)}${spp ? ` | ספ״פ ${spp}` : ""} | ממצא ${state.current + 1}/${state.results.length}`;
    renderTopWords(current);
    renderGrid(current);
  }

  function matchKey(match) {
    return match.word;
  }

  function readableTextColor(color) {
    const hex = String(color || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return "#111111";
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
  }

  function colorForKey(result, key) {
    const match = result.matches.find((item) => matchKey(item) === key);
    if (!match) return "#ffe15c";
    return match.kind === "primary" ? "#ff3c2f" : (match.color || stableColor(match.word));
  }

  function setWordColor(key, color) {
    state.results.forEach((result) => {
      result.matches.forEach((match) => {
        if (matchKey(match) === key && match.kind !== "primary") match.color = color;
      });
    });
    renderResults();
    renderCurrent();
    saveDraft();
  }

  function removeWordFromCurrent(key) {
    const current = state.results[state.current];
    if (!current) return;
    const target = current.matches.find((match) => matchKey(match) === key);
    if (!target || target.kind === "primary") {
      setStatus("לא ניתן להסיר את הראשית מהצופן.", 0);
      return;
    }
    current.matches = current.matches.filter((match) => matchKey(match) !== key);
    current.secondaryCount = countSecondaryWords(current.matches);
    state.lineKeys.delete(key);
    renderResults();
    renderCurrent();
    saveDraft();
    setStatus(`המילה "${target.word}" הוסרה מהצופן הנוכחי`, 0);
  }

  function removeWordFromAllResults(key) {
    const current = state.results[state.current];
    const target = current?.matches.find((match) => matchKey(match) === key);
    if (!target || target.kind === "primary") {
      setStatus("לא ניתן להסיר את הראשית מתוצאות החיפוש.", 0);
      return;
    }
    state.results.forEach((result) => {
      result.matches = result.matches.filter((match) => matchKey(match) !== key);
      result.secondaryCount = countSecondaryWords(result.matches);
    });
    state.lineKeys.delete(key);
    renderResults();
    renderCurrent();
    saveDraft();
    setStatus(`המילה "${target.word}" הוסרה מכל תוצאות החיפוש`, 0);
  }

  function openWordMenu(event, key) {
    event.preventDefault();
    state.activeWordKey = key;
    const current = state.results[state.current];
    const target = current?.matches.find((match) => matchKey(match) === key);
    els.toggleWordLine.hidden = edition !== "pro";
    els.removeWord.hidden = edition !== "pro";
    els.removeAllWord.hidden = edition !== "pro";
    els.removeWord.disabled = !target || target.kind === "primary";
    els.removeAllWord.disabled = !target || target.kind === "primary";
    els.toggleWordLine.textContent = state.lineKeys.has(key) ? "הסר קו למילה" : "הצג קו למילה";
    els.wordMenu.hidden = false;
    const menuWidth = 190;
    const menuHeight = 170;
    els.wordMenu.style.left = `${Math.max(6, Math.min(event.clientX, window.innerWidth - menuWidth - 6))}px`;
    els.wordMenu.style.top = `${Math.max(6, Math.min(event.clientY, window.innerHeight - menuHeight - 6))}px`;
  }

  function hideWordMenu() {
    els.wordMenu.hidden = true;
    state.activeWordKey = null;
  }

  function renderTopWords(result) {
    els.topWords.innerHTML = "";
    const chips = [];
    const grouped = new Map();
    result.matches.forEach((match) => {
      const key = matchKey(match);
      const existing = grouped.get(key);
      const skip = Math.abs(match.skip || 1);
      if (existing) {
        existing.count += 1;
        existing.skips.set(skip, (existing.skips.get(skip) || 0) + 1);
        if (match.kind === "primary") existing.kind = "primary";
      } else {
        grouped.set(key, {
          key,
          word: match.word,
          count: 1,
          skips: new Map([[skip, 1]]),
          kind: match.kind,
          color: match.kind === "primary" ? "#ff3c2f" : (match.color || stableColor(match.word)),
        });
      }
    });
    grouped.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "word-chip";
      chip.dataset.wordKey = item.key;
      chip.style.setProperty("--word-color", item.color);
      chip.style.setProperty("--word-text", readableTextColor(item.color));
      chip.style.borderColor = item.color;
      const skipText = Array.from(item.skips.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([skip, count]) => `${skip}${count > 1 ? ` ×${count}` : ""}`)
        .join(", ");
      chip.textContent = `${item.word} | ${skipText}${item.count > 1 ? ` | סה"כ ×${item.count}` : ""}`;
      chip.title = item.kind === "primary"
        ? "קליק ימני לפעולות"
        : "קליק ימני לפעולות; גרור למילה אחרת כדי להעתיק את הצבע";
      chip.draggable = edition === "pro" && item.kind !== "primary";
      chip.addEventListener("contextmenu", (event) => openWordMenu(event, item.key));
      chip.addEventListener("dragstart", (event) => {
        state.draggedWordKey = item.key;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", item.key);
      });
      chip.addEventListener("dragover", (event) => {
        if (!state.draggedWordKey || state.draggedWordKey === item.key) return;
        event.preventDefault();
        chip.classList.add("drag-target");
      });
      chip.addEventListener("dragleave", () => chip.classList.remove("drag-target"));
      chip.addEventListener("drop", (event) => {
        event.preventDefault();
        chip.classList.remove("drag-target");
        const sourceKey = state.draggedWordKey || event.dataTransfer.getData("text/plain");
        if (!sourceKey || sourceKey === item.key || item.kind === "primary") return;
        const color = colorForKey(result, sourceKey);
        setWordColor(item.key, color);
        setStatus(`הצבע הועתק אל "${item.word}"`, 100);
      });
      chip.addEventListener("dragend", () => {
        state.draggedWordKey = null;
        document.querySelectorAll(".word-chip.drag-target").forEach((itemNode) => itemNode.classList.remove("drag-target"));
      });
      chips.push(chip);
    });
    const measureRow = document.createElement("div");
    measureRow.className = "top-words-row";
    measureRow.style.position = "absolute";
    measureRow.style.visibility = "hidden";
    measureRow.style.width = "max-content";
    chips.forEach((chip) => measureRow.appendChild(chip));
    els.topWords.appendChild(measureRow);
    const widths = chips.map((chip) => chip.getBoundingClientRect().width + 5);
    const available = Math.max(1, els.topWords.clientWidth - 18);
    let split = chips.length;
    if (widths.reduce((sum, width) => sum + width, 0) > available && chips.length > 1) {
      let bestWidth = Infinity;
      for (let index = 1; index < chips.length; index += 1) {
        const widest = Math.max(
          widths.slice(0, index).reduce((sum, width) => sum + width, 0),
          widths.slice(index).reduce((sum, width) => sum + width, 0),
        );
        if (widest < bestWidth) {
          bestWidth = widest;
          split = index;
        }
      }
    }
    measureRow.remove();
    const groups = split < chips.length ? [chips.slice(0, split), chips.slice(split)] : [chips];
    groups.forEach((group) => {
      const row = document.createElement("div");
      row.className = "top-words-row";
      group.forEach((chip) => row.appendChild(chip));
      els.topWords.appendChild(row);
    });
    requestAnimationFrame(drawConnections);
  }

  function renderGrid(result) {
    const { grid, cols, center } = result.windowInfo;
    const markByPos = new Map();
    result.matches.forEach((match) => {
      positionsForMatch(match).forEach((pos) => {
        markByPos.set(pos, match);
      });
    });
    els.grid.style.setProperty("--cell-size", `${state.zoom}px`);
    els.grid.style.setProperty("--letter-size", `${Math.max(14, state.zoom - 1)}px`);
    const inner = document.createElement("div");
    inner.className = "grid-inner";
    inner.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size, 22px))`;
    grid.forEach((row) => {
      row.forEach((pos) => {
        const cell = document.createElement("span");
        cell.className = "letter-cell";
        if (pos !== null) {
          cell.textContent = state.torah[pos] || "";
          const match = markByPos.get(pos);
          if (match) {
            cell.classList.add(match.kind === "primary" ? "mark-primary" : "mark-secondary");
            if (match.kind !== "primary") cell.style.setProperty("--mark-color", match.color || stableColor(match.word));
            cell.dataset.wordKey = matchKey(match);
            cell.title = `${match.word} | דילוג ${Math.abs(match.skip || 1)} | מיקום ${(match.start + 1).toLocaleString("he-IL")}`;
            cell.addEventListener("contextmenu", (event) => openWordMenu(event, matchKey(match)));
          }
          if (pos === center) cell.classList.add("center");
        }
        inner.appendChild(cell);
      });
    });
    els.grid.replaceChildren(inner);
    requestAnimationFrame(() => {
      const centerCell = inner.querySelector(".letter-cell.center");
      if (centerCell) centerCell.scrollIntoView({ block: "center", inline: "center" });
      drawConnections();
    });
  }

  function drawConnections() {
    const current = state.results[state.current];
    els.connectionOverlay.replaceChildren();
    els.grid.querySelectorAll(".letter-cell.line-target").forEach((cell) => {
      cell.classList.remove("line-target");
      cell.style.removeProperty("--line-target-color");
      cell.style.removeProperty("--line-target-text");
    });
    if (!current || !state.lineKeys.size) return;
    const panel = els.connectionOverlay.parentElement;
    const panelRect = panel.getBoundingClientRect();
    els.connectionOverlay.setAttribute("viewBox", `0 0 ${panelRect.width} ${panelRect.height}`);
    state.lineKeys.forEach((key) => {
      const chip = Array.from(els.topWords.querySelectorAll("[data-word-key]"))
        .find((item) => item.dataset.wordKey === key);
      const gridRect = els.grid.getBoundingClientRect();
      const matchingCells = Array.from(els.grid.querySelectorAll("[data-word-key]"))
        .filter((item) => item.dataset.wordKey === key);
      const cell = matchingCells.find((item) => {
        const rect = item.getBoundingClientRect();
        return rect.right > gridRect.left
          && rect.left < gridRect.right
          && rect.bottom > gridRect.top
          && rect.top < gridRect.bottom;
      }) || matchingCells[0];
      if (!chip || !cell) return;
      const chipRect = chip.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const color = colorForKey(current, key);
      cell.classList.add("line-target");
      cell.style.setProperty("--line-target-color", color);
      cell.style.setProperty("--line-target-text", readableTextColor(color));
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(chipRect.left + chipRect.width / 2 - panelRect.left));
      line.setAttribute("y1", String(chipRect.bottom - panelRect.top));
      line.setAttribute("x2", String(cellRect.left + cellRect.width / 2 - panelRect.left));
      line.setAttribute("y2", String(cellRect.top + cellRect.height / 2 - panelRect.top));
      line.setAttribute("stroke", color);
      els.connectionOverlay.appendChild(line);
    });
  }

  function scrollDisplay(horizontalCells, verticalRows) {
    const step = state.zoom + 2;
    els.grid.scrollBy({
      left: horizontalCells * step,
      top: verticalRows * step,
      behavior: "auto",
    });
    requestAnimationFrame(drawConnections);
  }

  function bindRepeatingButton(button, action) {
    let delayTimer = 0;
    let repeatTimer = 0;
    let pressed = false;

    const stop = () => {
      pressed = false;
      window.clearTimeout(delayTimer);
      window.clearInterval(repeatTimer);
      delayTimer = 0;
      repeatTimer = 0;
    };
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      pressed = true;
      button.setPointerCapture?.(event.pointerId);
      action();
      delayTimer = window.setTimeout(() => {
        if (!pressed) return;
        repeatTimer = window.setInterval(action, 65);
      }, 180);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => {
      button.addEventListener(name, stop);
    });
    button.addEventListener("click", (event) => {
      if (event.detail === 0) action();
    });
  }

  function renderEmptyGrid(text) {
    els.title.textContent = "תצוגת התורה";
    els.topWords.innerHTML = "";
    const box = document.createElement("div");
    box.className = "result-summary";
    box.textContent = text;
    els.grid.replaceChildren(box);
  }

  function clearAll() {
    els.primary.value = "";
    els.secondary.value = "";
    state.results = [];
    state.current = 0;
    state.primaryCache = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Clearing the visible work still succeeds when browser storage is blocked.
    }
    renderResults();
    renderEmptyGrid("לא בוצע חיפוש.");
    setStatus("השדות נוקו.", 0);
  }

  function moveResult(delta) {
    if (!state.results.length) return;
    state.current = (state.current + delta + state.results.length) % state.results.length;
    state.lineKeys.clear();
    renderResults();
    renderCurrent();
  }

  function printCurrent() {
    if (!state.results.length) {
      setStatus("אין צופן להצגה בהדפסה", 0);
      return;
    }
    renderCurrent();
    setStatus("פותח תצוגת הדפסה...", els.progress.value);
    window.print();
  }

  function exportStyleText() {
    const parts = [];
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules || []).forEach((rule) => parts.push(rule.cssText));
      } catch {
        // Only same-origin styles are needed for this page.
      }
    });
    return parts.join("\n");
  }

  async function saveCurrentImage() {
    if (!state.results.length) {
      setStatus("אין צופן לשמירה כתמונה", 0);
      return;
    }
    renderCurrent();
    const source = document.querySelector(".torah-panel");
    const clone = source.cloneNode(true);
    clone.querySelector(".display-controls")?.remove();
    clone.querySelectorAll(".no-export-control").forEach((node) => node.remove());
    clone.style.cssText = [
      "display:block",
      "position:static",
      "width:max-content",
      "min-width:1100px",
      "height:auto",
      "max-height:none",
      "overflow:visible",
      "border:8px solid #000",
      "border-radius:0",
      "box-shadow:none",
      "background:#fff",
      "direction:rtl",
    ].join(";");
    const clonedGrid = clone.querySelector(".torah-grid");
    if (clonedGrid) {
      clonedGrid.style.cssText += ";height:auto;max-height:none;overflow:visible;background:#fff";
    }
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-100000px;top:0;background:#fff";
    host.appendChild(clone);
    document.body.appendChild(host);
    const width = Math.ceil(Math.max(clone.scrollWidth, clone.getBoundingClientRect().width));
    const height = Math.ceil(Math.max(clone.scrollHeight, clone.getBoundingClientRect().height));
    const markup = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <style>${exportStyleText()}</style>
            ${clone.outerHTML}
          </div>
        </foreignObject>
      </svg>`;
    host.remove();
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      const scale = Math.min(2, Math.max(1, 1800 / width));
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.download = `${safeFileName(state.results[state.current].primary.word || "gal-einai")}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus("תמונת הצופן נשמרה ללא כפתורי הניווט", 100);
    } catch {
      setStatus("הדפדפן לא הצליח להכין את התמונה. אפשר להשתמש בהדפסה ל-PDF.", 0);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  els.form.addEventListener("submit", (event) => search(event));
  els.secondaryScan.addEventListener("click", () => search(null, { cacheOnly: true }));
  els.stop.addEventListener("click", () => {
    state.stop = true;
    setStatus("בקשת עצירה התקבלה...", els.progress.value);
  });
  els.clear.addEventListener("click", clearAll);
  els.openProject.addEventListener("click", () => {
    els.projectFile.click();
  });
  els.saveProject.addEventListener("click", saveProjectFile);
  els.library.addEventListener("click", openLibrary);
  els.history.addEventListener("click", openHistory);
  els.export.addEventListener("click", openExport);
  els.libraryClose.addEventListener("click", () => els.libraryDialog.close());
  els.libraryForm.addEventListener("submit", saveToLibrary);
  els.librarySearch.addEventListener("input", renderLibrary);
  els.libraryBackup.addEventListener("click", backupLibrary);
  els.libraryRestore.addEventListener("click", () => els.libraryBackupInput.click());
  els.libraryBackupInput.addEventListener("change", async () => {
    const file = els.libraryBackupInput.files && els.libraryBackupInput.files[0];
    if (!file) return;
    try {
      mergeLibraryBackup(JSON.parse(await file.text()));
    } catch (error) {
      setStatus(`שגיאה בשחזור הספרייה: ${error.message}`, 0);
    } finally {
      els.libraryBackupInput.value = "";
    }
  });
  els.libraryDialog.addEventListener("click", (event) => {
    if (event.target === els.libraryDialog) els.libraryDialog.close();
  });
  els.historyClose.addEventListener("click", () => els.historyDialog.close());
  els.historyClear.addEventListener("click", () => {
    if (!readHistory().length) return;
    if (!window.confirm("למחוק את כל היסטוריית החיפושים?")) return;
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // The dialog remains usable even if storage access is blocked.
    }
    renderHistory();
    setStatus("היסטוריית החיפושים נוקתה", 0);
  });
  els.historyDialog.addEventListener("click", (event) => {
    if (event.target === els.historyDialog) els.historyDialog.close();
  });
  els.exportClose.addEventListener("click", () => els.exportDialog.close());
  els.copySummary.addEventListener("click", copyExportSummary);
  els.downloadCsv.addEventListener("click", downloadResultsCsv);
  els.exportDialog.addEventListener("click", (event) => {
    if (event.target === els.exportDialog) els.exportDialog.close();
  });
  els.projectFile.addEventListener("change", async () => {
    const file = els.projectFile.files && els.projectFile.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      loadProjectData(data, file.name);
    } catch (error) {
      setStatus(`שגיאה בפתיחת צופן: ${error.message}`, 0);
    } finally {
      els.projectFile.value = "";
    }
  });
  els.print.addEventListener("click", printCurrent);
  els.saveImage.addEventListener("click", saveCurrentImage);
  els.toggleDisplayControls.addEventListener("click", toggleDisplayControls);
  bindRepeatingButton(els.prev, () => moveResult(-1));
  bindRepeatingButton(els.next, () => moveResult(1));
  bindRepeatingButton(els.scrollRight, () => scrollDisplay(-1, 0));
  bindRepeatingButton(els.scrollLeft, () => scrollDisplay(1, 0));
  bindRepeatingButton(els.scrollUp, () => scrollDisplay(0, -1));
  bindRepeatingButton(els.scrollDown, () => scrollDisplay(0, 1));
  els.zoomIn.addEventListener("click", () => {
    state.zoom = Math.min(34, state.zoom + 2);
    renderCurrent();
  });
  els.zoomOut.addEventListener("click", () => {
    state.zoom = Math.max(16, state.zoom - 2);
    renderCurrent();
  });
  els.zoomReset.addEventListener("click", () => {
    state.zoom = 24;
    renderCurrent();
  });
  els.grid.addEventListener("scroll", () => requestAnimationFrame(drawConnections), { passive: true });
  els.grid.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const horizontalDelta = event.deltaX || event.deltaY;
      scrollDisplay(horizontalDelta > 0 ? 1 : -1, 0);
    } else {
      scrollDisplay(0, event.deltaY > 0 ? 1 : -1);
    }
  }, { passive: false });
  els.grid.addEventListener("keydown", (event) => {
    const moves = {
      ArrowRight: [-1, 0],
      ArrowLeft: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    scrollDisplay(move[0], move[1]);
  });
  els.changeWordColor.addEventListener("click", () => {
    if (!state.activeWordKey) return;
    const current = state.results[state.current];
    els.wordColor.value = colorForKey(current, state.activeWordKey);
    els.wordColor.click();
  });
  els.wordColor.addEventListener("input", () => {
    if (!state.activeWordKey) return;
    setWordColor(state.activeWordKey, els.wordColor.value);
    hideWordMenu();
  });
  els.toggleWordLine.addEventListener("click", () => {
    const key = state.activeWordKey;
    if (!key) return;
    if (state.lineKeys.has(key)) state.lineKeys.delete(key);
    else state.lineKeys.add(key);
    hideWordMenu();
    drawConnections();
  });
  els.removeWord.addEventListener("click", () => {
    const key = state.activeWordKey;
    hideWordMenu();
    if (key) removeWordFromCurrent(key);
  });
  els.removeAllWord.addEventListener("click", () => {
    const key = state.activeWordKey;
    hideWordMenu();
    if (key) removeWordFromAllResults(key);
  });
  els.help.addEventListener("click", () => els.helpDialog.showModal());
  els.helpClose.addEventListener("click", () => els.helpDialog.close());
  els.helpDialog.addEventListener("click", (event) => {
    if (event.target === els.helpDialog) els.helpDialog.close();
  });
  els.tools.addEventListener("click", () => els.toolsDialog.showModal());
  els.toolsClose.addEventListener("click", () => els.toolsDialog.close());
  els.toolsDialog.addEventListener("click", (event) => {
    if (event.target === els.toolsDialog) els.toolsDialog.close();
  });
  els.avotPrev.addEventListener("click", () => stepAvot(-1));
  els.avotNext.addEventListener("click", () => stepAvot(1));
  els.avotTicker.addEventListener("mouseenter", () => { state.avotPaused = true; });
  els.avotTicker.addEventListener("mouseleave", () => { state.avotPaused = false; });
  els.avotVisible.addEventListener("change", () => {
    state.avotVisible = els.avotVisible.checked;
    applyAvotSettings();
  });
  els.avotSpeed.addEventListener("input", () => {
    state.avotSpeed = Number(els.avotSpeed.value) || 4;
    applyAvotSettings();
  });
  [els.avotOrdered, els.avotRandom].forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.avotOrder = input.value;
      applyAvotSettings();
    });
  });
  document.addEventListener("pointerdown", (event) => {
    if (!els.wordMenu.hidden && !els.wordMenu.contains(event.target)) hideWordMenu();
  });
  window.addEventListener("resize", () => {
    const current = state.results[state.current];
    if (current) renderTopWords(current);
    requestAnimationFrame(drawConnections);
  });

  loadTorah()
    .then(async () => {
      if (pageParams.has("project")) {
        await loadProjectFromQuery().catch((error) => setStatus(`שגיאה בטעינת צופן: ${error.message}`, 0));
      } else {
        restoreDraft();
      }
    })
    .catch((error) => setStatus(`שגיאה בטעינת התורה: ${error.message}`, 0));

  try {
    state.displayControlsVisible = localStorage.getItem(DISPLAY_CONTROLS_KEY) !== "hidden";
    const avotSettings = JSON.parse(localStorage.getItem(AVOT_SETTINGS_KEY) || "{}");
    state.avotVisible = avotSettings.visible !== false;
    state.avotSpeed = Number(avotSettings.speed) || 4;
    state.avotOrder = avotSettings.order === "random" ? "random" : "ordered";
  } catch {
    state.displayControlsVisible = true;
    state.avotVisible = true;
    state.avotSpeed = 4;
    state.avotOrder = "ordered";
  }
  applyEdition();
  applyDisplayControlsVisibility();
  applyAvotSettings();
  loadAvot();
  requestAnimationFrame(animateAvot);
})();
