(() => {
  "use strict";

  const TARGET_COUNT = 304805;
  const FREE_MAX_RESULTS = 30;
  const PRO_MAX_RESULTS = 250;
  const DEFAULT_ROWS = 27;
  const DEFAULT_EXTRA_COLS = 10;
  const DRAFT_KEY = "gal-einai-web-draft-v1";
  const LIBRARY_KEY = "gal-einai-web-library-v1";
  const LIBRARY_LIMIT = 20;
  const HISTORY_KEY = "gal-einai-web-history-v1";
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
    index: new Map(),
    results: [],
    current: 0,
    stop: false,
    searching: false,
    zoom: 22,
    primaryCache: null,
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
    prev: $("prevResultButton"),
    next: $("nextResultButton"),
    zoomIn: $("zoomInButton"),
    zoomOut: $("zoomOutButton"),
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
      version: "W016",
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
      version: "W016",
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
    const response = await fetch("assets/torah_clean.txt", { cache: "force-cache" });
    if (!response.ok) throw new Error("לא הצלחתי לטעון את טקסט התורה");
    const raw = await response.text();
    state.torah = raw.replace(/[^\u05d0-\u05ea]/g, "");
    buildIndex();
    const ok = state.torah.length === TARGET_COUNT;
    setStatus(ok ? `טקסט התורה נטען: ${state.torah.length.toLocaleString("he-IL")} אותיות` : `טקסט התורה נטען, אך האורך אינו צפוי: ${state.torah.length.toLocaleString("he-IL")}`, 0);
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
    const cols = Math.min(180, Math.max(24, skipAbs + DEFAULT_EXTRA_COLS));
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
    els.title.textContent = `טבלה בדילוג ${Math.abs(current.primary.skip)} | ממצא ${state.current + 1}/${state.results.length}`;
    renderTopWords(current);
    renderGrid(current);
  }

  function renderTopWords(result) {
    els.topWords.innerHTML = "";
    const grouped = new Map();
    result.matches.forEach((match) => {
      const key = `${match.word}|${Math.abs(match.skip || 1)}`;
      grouped.set(key, { word: match.word, skip: Math.abs(match.skip || 1), count: (grouped.get(key)?.count || 0) + 1, kind: match.kind });
    });
    grouped.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "word-chip";
      chip.style.borderColor = item.kind === "primary" ? "#ff4d3d" : stableColor(item.word);
      chip.textContent = `${item.word} | ${item.skip}${item.count > 1 ? ` ×${item.count}` : ""}`;
      els.topWords.appendChild(chip);
    });
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
    els.grid.style.setProperty("--letter-size", `${Math.max(12, state.zoom - 6)}px`);
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
            cell.title = `${match.word} | דילוג ${Math.abs(match.skip || 1)} | מיקום ${(match.start + 1).toLocaleString("he-IL")}`;
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
  els.prev.addEventListener("click", () => moveResult(-1));
  els.next.addEventListener("click", () => moveResult(1));
  els.zoomIn.addEventListener("click", () => {
    state.zoom = Math.min(34, state.zoom + 2);
    renderCurrent();
  });
  els.zoomOut.addEventListener("click", () => {
    state.zoom = Math.max(16, state.zoom - 2);
    renderCurrent();
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

  applyEdition();
})();
