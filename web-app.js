(() => {
  "use strict";

  const TARGET_COUNT = 304805;
  const MAX_RESULTS = 250;
  const DEFAULT_ROWS = 27;
  const DEFAULT_EXTRA_COLS = 10;
  const DRAFT_KEY = "gal-einai-web-draft-v1";
  const LIBRARY_KEY = "gal-einai-web-library-v1";
  const LIBRARY_LIMIT = 20;
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
    libraryDialog: $("libraryDialog"),
    libraryClose: $("closeLibraryButton"),
    libraryForm: $("librarySaveForm"),
    libraryName: $("libraryNameInput"),
    libraryList: $("libraryList"),
    libraryCount: $("libraryCount"),
  };

  function applyEdition() {
    document.body.dataset.edition = edition;
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set("edition", edition === "free" ? "pro" : "free");
    els.editionBadge.textContent = edition === "free" ? "חינמית" : "מקצועית | בטא פתוחה";
    els.editionSwitch.textContent = edition === "free" ? "נסה מקצועית" : "עבור לחינמית";
    els.editionSwitch.href = `web.html?${nextParams.toString()}`;
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
      version: "W011",
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
    els.libraryCount.textContent = `${items.length} מתוך ${LIBRARY_LIMIT} צפנים`;
    els.libraryList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "library-empty";
      empty.textContent = "עדיין לא נשמרו צפנים בספרייה.";
      els.libraryList.appendChild(empty);
      return;
    }
    items.forEach((item) => {
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
    state.results = saved.map(resultFromSavedItem).filter(Boolean).slice(0, MAX_RESULTS);
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
    const from = Math.max(1, Math.abs(Number.parseInt(els.skipFrom.value || "1", 10) || 1));
    const to = Math.max(from, Math.abs(Number.parseInt(els.skipTo.value || String(from), 10) || from));
    const cacheKey = primaryCacheKey(primaryWords, from, to);
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
        if (state.results.length >= MAX_RESULTS) break;
      }
      state.results.sort((a, b) => b.secondaryCount - a.secondaryCount || Math.abs(a.primary.skip) - Math.abs(b.primary.skip));
      setStatus(`החיפוש הסתיים | ראשיות ${primaries.length} | צפנים ${state.results.length}`, 100);
      renderResults();
      renderCurrent();
      saveDraft();
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
  els.libraryClose.addEventListener("click", () => els.libraryDialog.close());
  els.libraryForm.addEventListener("submit", saveToLibrary);
  els.libraryDialog.addEventListener("click", (event) => {
    if (event.target === els.libraryDialog) els.libraryDialog.close();
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
