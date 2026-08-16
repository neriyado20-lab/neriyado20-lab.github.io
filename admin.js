(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const CONTACT_STORAGE_KEY = "gal-einai-contact-v1";
  const CONTENT_STORAGE_KEY = "gal-einai-admin-content-v1";
  const ARCHIVED_CONTENT_KEY = "gal-einai-archived-content-v1";
  const ARCHIVED_STATIC_IDS_KEY = "gal-einai-archived-static-ciphers-v1";
  const ADDITIONS_KEY = "gal-einai-my-cipher-additions-v1";
  const ARCHIVE_EVENT_KEY = "gal-einai-web-archive-events-v1";
  const RETENTION_KEY = "gal-einai-admin-retention-v1";
  const AUTH_SESSION_KEY = "gal-einai-admin-authenticated-v1";
  const UPLOAD_DB_NAME = "gal-einai-admin-uploads-v1";
  const UPLOAD_STORE_NAME = "files";
  const CONFIG = window.GAL_EINAI_INTERACTIONS || {};
  const AUTH = window.GAL_EINAI_ADMIN_AUTH || {};
  const supabaseClient = AUTH.supabaseUrl && AUTH.supabasePublishableKey && window.supabase
    ? window.supabase.createClient(AUTH.supabaseUrl, AUTH.supabasePublishableKey)
    : null;
  let autoCleanupDone = false;
  const CIPHER_TITLES = {
    "ketamuz-1407": "כתמוז 1407",
    "ketamuz-hatashpu": "כתמוז תשפו",
    "rav-amos-hatashpu-milchama": "הרב עמוס התשפו מלחמה",
    "atom-petzatza-iran": "אטום פצצה אירן",
    "vetamuz-hatashpu-yenatzchu": "ותמוז התשפו ינצחו",
    "tamuz-hatashpu-podeh-melech-71": "תמוז התשפו פודה מלך 71",
    "geula-m-hapeh-bigevura": "גאולה מ ה-פה בגבורה",
    "hey-july": "ה יולי",
    "yom-mashiach-ba-583-ketamuz": "יום משיח בא 583 כתמוז",
    "leshiul-shemen-zayit-lechem-boker": "לשיעול שמן זית ולחם בקר",
    "heymanot-kesau": "הימנוט קסאו"
  };
  const STATIC_CIPHER_TOPICS = {
    "ketamuz-1407": "dates",
    "ketamuz-hatashpu": "dates",
    "rav-amos-hatashpu-milchama": "events",
    "atom-petzatza-iran": "events",
    "vetamuz-hatashpu-yenatzchu": "events",
    "tamuz-hatashpu-podeh-melech-71": "geula",
    "geula-m-hapeh-bigevura": "geula",
    "hey-july": "dates",
    "yom-mashiach-ba-583-ketamuz": "geula",
    "leshiul-shemen-zayit-lechem-boker": "healing",
    "heymanot-kesau": "events"
  };
  const STATIC_CIPHER_PROJECTS = {
    "atom-petzatza-iran": "ciphers/atom-petzatza-iran.gal_einai.json",
    "vetamuz-hatashpu-yenatzchu": "ciphers/vetamuz-yenatzchu-israel-iran-hatashpu.gal_einai.json",
    "tamuz-hatashpu-podeh-melech-71": "ciphers/tamuz3.gal_einai.json"
  };

  function $(id) {
    return document.getElementById(id);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function isAuthenticated() {
    if (!AUTH.enabled) return true;
    return sessionStorage.getItem(AUTH_SESSION_KEY) === "yes";
  }

  function wirePasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      const input = $(button.dataset.passwordToggle);
      if (!input) return;
      button.addEventListener("click", () => {
        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.setAttribute("aria-label", shouldShow ? "הסתר סיסמה" : "הצג סיסמה");
        button.title = shouldShow ? "הסתר סיסמה" : "הצג סיסמה";
        button.classList.toggle("is-active", shouldShow);
      });
    });
  }

  function adminEmailLooksDeliverable() {
    const email = String(AUTH.supabaseAdminEmail || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/\.local$/i.test(email);
  }

  function isPasswordRecoveryUrl() {
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    return params.get("type") === "recovery" || params.get("reset") === "admin" || hash.get("type") === "recovery";
  }

  function clearRecoveryUrl() {
    if (!history.replaceState) return;
    history.replaceState(null, document.title, `${location.origin}${location.pathname}`);
  }

  function setAuthenticated(value) {
    if (value) sessionStorage.setItem(AUTH_SESSION_KEY, "yes");
    else sessionStorage.removeItem(AUTH_SESSION_KEY);
    document.body.classList.toggle("admin-locked", !value);
    document.body.classList.toggle("admin-unlocked", value);
  }

  function storageSetupMessage(bucketName = "public-ciphers") {
    return `חסר ב-Supabase מאגר אחסון בשם ${bucketName}. צריך להריץ פעם אחת את הקובץ supabase-setup.sql בלוח הבקרה של Supabase, ואז לחזור לכאן ולרענן.`;
  }

  function friendlyError(error) {
    const message = String(error?.message || error?.error_description || error || "").trim();
    if (!message) return "";
    if (/jwt|session|auth|login|not authenticated/i.test(message)) return "הכניסה למנהל פגה. יש להיכנס מחדש.";
    if (/bucket not found|bucket.*not found|storage.*bucket/i.test(message)) return storageSetupMessage();
    if (/row-level|policy|permission|unauthorized|forbidden|403/i.test(message)) return "אין הרשאת מנהל לאחסון הצפנים. צריך לסדר את הרשאת האחסון של חשבון המנהל.";
    if (/network|fetch|failed to fetch|timeout/i.test(message)) return "הדפדפן לא הצליח להתחבר לשרת האחסון. בדוק אינטרנט או סינון.";
    return message;
  }

  async function requireCipherStorageReady(statusElement = null) {
    if (!supabaseClient) {
      return {
        ok: false,
        message: "העלאה לאתר עדיין לא מחוברת. צריך חיבור מנהל לשרת האחסון."
      };
    }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      return { ok: false, message: friendlyError(error) || "לא הצלחתי לבדוק את הכניסה למנהל." };
    }
    const email = data.session?.user?.email || "";
    if (!data.session) {
      return { ok: false, message: "צריך להיכנס מחדש למנהל לפני העלאת צופן." };
    }
    if (String(email).trim().toLowerCase() !== String(AUTH.supabaseAdminEmail).trim().toLowerCase()) {
      return {
        ok: false,
        message: `הדפדפן מחובר כ-${email || "משתמש אחר"}, ולא כחשבון המנהל. יש לצאת ולהיכנס מחדש.`
      };
    }
    if (statusElement) statusElement.textContent = "בודק הרשאת אחסון...";
    const { error: listError } = await supabaseClient.storage.from("public-ciphers").list("", { limit: 1 });
    if (listError) {
      return {
        ok: false,
        message: friendlyError(listError) || storageSetupMessage()
      };
    }
    return { ok: true, message: "החיבור לאוצר הצפנים פעיל." };
  }

  async function requireAdminConnection(statusElement = null) {
    if (!supabaseClient) {
      return { ok: false, message: "אין כרגע חיבור ניהול לאתר. השינוי יישמר רק בדפדפן הזה." };
    }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      const message = friendlyError(error) || "לא הצלחתי לבדוק את החיבור למנהל.";
      if (statusElement) statusElement.textContent = message;
      return { ok: false, message };
    }
    const email = data.session?.user?.email || "";
    if (!data.session) {
      setAuthenticated(false);
      const message = "הכניסה למנהל פגה. הכנס קוד וסיסמה ואז נסה שוב.";
      if (statusElement) statusElement.textContent = message;
      $("adminLoginCode")?.focus();
      return { ok: false, message };
    }
    if (String(email).trim().toLowerCase() !== String(AUTH.supabaseAdminEmail).trim().toLowerCase()) {
      const message = `מחובר כ-${email || "משתמש אחר"}, לא כחשבון המנהל. צא והיכנס מחדש.`;
      if (statusElement) statusElement.textContent = message;
      return { ok: false, message };
    }
    return { ok: true, message: "חיבור המנהל פעיל." };
  }

  async function assertAdminConnection() {
    const ready = await requireAdminConnection();
    if (!ready.ok) throw new Error(ready.message);
  }

  function wireAuth() {
    const loginForm = $("adminLoginForm");
    const logoutButton = $("adminLogoutButton");
    const forgotButton = $("adminForgotPasswordButton");
    const status = $("adminLoginStatus");
    setAuthenticated(isAuthenticated());

    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = $("adminLoginCode").value.trim();
      const password = $("adminLoginPassword").value;
      const [codeHash, passwordHash] = await Promise.all([sha256(code), sha256(password)]);
      if (codeHash === AUTH.codeHash && passwordHash === AUTH.passwordHash) {
        setAuthenticated(true);
        status.textContent = "";
        render();
        return;
      }
      status.textContent = "קוד או סיסמה שגויים.";
    });

    forgotButton?.addEventListener("click", () => {
      status.textContent = "איפוס סיסמת מנהל נעשה דרך Supabase: Authentication > Users > admin@gal-einai.local > Send password reset. אם אין אימייל אמיתי, צריך לקבוע סיסמה חדשה שם.";
    });

    logoutButton?.addEventListener("click", () => {
      setAuthenticated(false);
      $("adminLoginPassword").value = "";
      $("adminLoginCode").focus();
    });
  }

  async function wireSupabaseAuth() {
    const loginForm = $("adminLoginForm");
    const resetForm = $("adminPasswordResetForm");
    const logoutButton = $("adminLogoutButton");
    const forgotButton = $("adminForgotPasswordButton");
    const backToLoginButton = $("adminBackToLoginButton");
    const status = $("adminLoginStatus");
    const resetStatus = $("adminPasswordResetStatus");

    function showLogin(message = "") {
      if (loginForm) loginForm.hidden = false;
      if (resetForm) resetForm.hidden = true;
      if (status) status.textContent = message;
    }

    function showPasswordReset(message = "") {
      if (loginForm) loginForm.hidden = true;
      if (resetForm) resetForm.hidden = false;
      if (resetStatus) resetStatus.textContent = message;
      $("adminNewPassword")?.focus();
    }

    supabaseClient.auth.onAuthStateChange((eventName, session) => {
      if (eventName === "PASSWORD_RECOVERY") {
        showPasswordReset("הכנס סיסמה חדשה לחשבון המנהל.");
        setAuthenticated(false);
        return;
      }
      setAuthenticated(Boolean(session));
      if (session) {
        render();
        renderRemoteSubmissions();
        loadRemoteContent();
        loadLicenses();
        requireAdminConnection($("adminBackendStatus"));
      }
    });

    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = $("adminLoginCode").value.trim();
      const password = $("adminLoginPassword").value;
      const codeHash = await sha256(code);
      if (codeHash !== AUTH.codeHash) {
        status.textContent = "קוד או סיסמה שגויים.";
        return;
      }
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: AUTH.supabaseAdminEmail,
        password
      });
      if (error) {
        status.textContent = "קוד או סיסמה שגויים.";
        return;
      }
      status.textContent = "";
      setAuthenticated(true);
      render();
      renderRemoteSubmissions();
      loadRemoteContent();
      loadLicenses();
      requireAdminConnection($("adminBackendStatus"));
    });

    forgotButton?.addEventListener("click", async () => {
      if (!adminEmailLooksDeliverable()) {
        status.textContent = "איפוס במייל אינו פעיל כי כתובת המנהל אינה כתובת מייל אמיתית. יש להגדיר בקובץ admin-config.js כתובת מנהל אמיתית ב-Supabase, או לקבוע סיסמה חדשה מתוך לוח Supabase.";
        return;
      }
      const { error } = await supabaseClient.auth.resetPasswordForEmail(AUTH.supabaseAdminEmail, {
        redirectTo: `${location.origin}${location.pathname}?reset=admin`
      });
      status.textContent = error
        ? `לא הצלחתי לשלוח איפוס: ${friendlyError(error) || "צריך לבדוק את הגדרת האימייל ב-Supabase."}`
        : "נשלח קישור איפוס סיסמה לאימייל המנהל, אם מוגדרת שליחת אימייל ב-Supabase.";
    });

    resetForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = $("adminNewPassword")?.value || "";
      const confirm = $("adminNewPasswordConfirm")?.value || "";
      if (password.length < 6) {
        resetStatus.textContent = "הסיסמה צריכה להכיל לפחות 6 תווים.";
        return;
      }
      if (password !== confirm) {
        resetStatus.textContent = "שתי הסיסמאות אינן זהות.";
        return;
      }
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const email = sessionData.session?.user?.email || "";
      if (!sessionData.session) {
        resetStatus.textContent = "קישור האיפוס אינו פעיל יותר. שלח קישור איפוס חדש ופתח אותו מאותו דפדפן.";
        return;
      }
      if (String(email).trim().toLowerCase() !== String(AUTH.supabaseAdminEmail).trim().toLowerCase()) {
        resetStatus.textContent = "קישור האיפוס אינו שייך לחשבון המנהל.";
        return;
      }
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) {
        resetStatus.textContent = `לא הצלחתי לשמור סיסמה חדשה: ${friendlyError(error) || "נסה שוב."}`;
        return;
      }
      $("adminNewPassword").value = "";
      $("adminNewPasswordConfirm").value = "";
      clearRecoveryUrl();
      await supabaseClient.auth.signOut();
      setAuthenticated(false);
      showLogin("הסיסמה החדשה נשמרה. כעת אפשר להיכנס עם קוד המנהל והסיסמה החדשה.");
    });

    backToLoginButton?.addEventListener("click", async () => {
      clearRecoveryUrl();
      showLogin("");
    });

    logoutButton?.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      setAuthenticated(false);
      $("adminLoginPassword").value = "";
      $("adminLoginCode").focus();
    });

    try {
      const { data } = await supabaseClient.auth.getSession();
      const recoveryMode = isPasswordRecoveryUrl();
      if (recoveryMode) {
        showPasswordReset(data.session
          ? "הכנס סיסמה חדשה לחשבון המנהל."
          : "קישור האיפוס נפתח, אך לא נמצאה התחברות שחזור פעילה. נסה לפתוח את הקישור שוב מאותו דפדפן.");
      }
      setAuthenticated(Boolean(data.session) && !recoveryMode);
      if (data.session && !recoveryMode) {
        render();
        renderRemoteSubmissions();
        loadRemoteContent();
        loadLicenses();
        requireAdminConnection($("adminBackendStatus"));
      }
    } catch (error) {
      setAuthenticated(false);
      showLogin(friendlyError(error) || "לא הצלחתי לבדוק חיבור מנהל. אפשר לנסות להיכנס שוב.");
    }
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

  function readContactItems() {
    try {
      const raw = localStorage.getItem(CONTACT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readAdditionItems() {
    try {
      const raw = localStorage.getItem(ADDITIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readArchiveItems() {
    try {
      const raw = localStorage.getItem(ARCHIVE_EVENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readContentItems() {
    try {
      const raw = localStorage.getItem(CONTENT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeContentItems(items) {
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(items.slice(-200)));
  }

  function readLocalArchivedContent() {
    try {
      const raw = localStorage.getItem(ARCHIVED_CONTENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocalArchivedContent(items) {
    try {
      localStorage.setItem(ARCHIVED_CONTENT_KEY, JSON.stringify(items.slice(-300)));
    } catch {
      // The remote save remains authoritative when browser storage is unavailable.
    }
  }

  function readArchivedStaticIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARCHIVED_STATIC_IDS_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function writeArchivedStaticIds(ids) {
    try {
      localStorage.setItem(ARCHIVED_STATIC_IDS_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      // The full archive record remains as the main fallback.
    }
  }

  function staticIdForItem(item) {
    const id = String(item?.id || "");
    return id.startsWith("static-") ? id : "";
  }

  function rememberArchivedStaticId(item) {
    const id = staticIdForItem(item);
    if (!id) return;
    const ids = readArchivedStaticIds();
    ids.add(id);
    writeArchivedStaticIds(ids);
  }

  function forgetArchivedStaticId(item) {
    const id = staticIdForItem(item);
    if (!id) return;
    const ids = readArchivedStaticIds();
    ids.delete(id);
    writeArchivedStaticIds(ids);
  }

  function absoluteContentUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return String(url || "");
    }
  }

  function contentIdentityKeys(item) {
    const keys = new Set();
    if (!item) return keys;
    if (item.id) keys.add(`id:${String(item.id).trim().toLowerCase()}`);
    if (item.title) keys.add(`title:${String(item.title).trim().toLowerCase()}`);
    [item.url, markerValue(item.description, "image"), markerValue(item.description, "project")]
      .filter(Boolean)
      .forEach((url) => {
        const absolute = absoluteContentUrl(String(url).trim());
        keys.add(`url:${absolute.toLowerCase()}`);
        const fileName = absolute.split(/[?#]/)[0].split("/").pop();
        if (fileName) keys.add(`file:${fileName.toLowerCase()}`);
      });
    return keys;
  }

  function hasSharedIdentity(a, b) {
    const aKeys = contentIdentityKeys(a);
    for (const key of contentIdentityKeys(b)) {
      if (aKeys.has(key)) return true;
    }
    return false;
  }

  function archivedIdentityKeys(items = []) {
    const keys = new Set();
    [...items, ...readLocalArchivedContent()]
      .filter((item) => item?.type === "example" || !item?.type)
      .filter((item) => item?.status === "archive" || item?.status === "draft")
      .forEach((item) => contentIdentityKeys(item).forEach((key) => keys.add(key)));
    return keys;
  }

  function hasArchivedIdentity(item, items = []) {
    const staticId = staticIdForItem(item);
    if (staticId && readArchivedStaticIds().has(staticId)) return true;
    const archived = archivedIdentityKeys(items);
    for (const key of contentIdentityKeys(item)) {
      if (archived.has(key)) return true;
    }
    return false;
  }

  function rememberLocalArchive(item) {
    if (!item?.id) return;
    const items = readLocalArchivedContent().filter((candidate) => candidate.id !== item.id && !hasSharedIdentity(candidate, item));
    writeLocalArchivedContent([...items, { ...item, type: item.type || "example", status: item.status || "archive" }]);
    rememberArchivedStaticId(item);
  }

  function forgetLocalArchive(item) {
    if (!item?.id) return;
    writeLocalArchivedContent(readLocalArchivedContent().filter((candidate) => candidate.id !== item.id && !hasSharedIdentity(candidate, item)));
    forgetArchivedStaticId(item);
  }

  function retentionValue() {
    return localStorage.getItem(RETENTION_KEY) || "manual";
  }

  function retentionDays() {
    const value = retentionValue();
    if (value === "manual" || value === "never") return null;
    const days = Number.parseInt(value, 10);
    return Number.isFinite(days) && days > 0 ? days : null;
  }

  function cutoffDate(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  function filterByRetention(items, days) {
    if (!days) return items;
    const cutoff = Date.parse(cutoffDate(days));
    return items.filter((item) => {
      const time = Date.parse(item.at || item.created_at || "");
      return !Number.isFinite(time) || time >= cutoff;
    });
  }

  function deleteLocalReceived(days = null) {
    if (!days) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONTACT_STORAGE_KEY);
      localStorage.removeItem(ADDITIONS_KEY);
      localStorage.removeItem(ARCHIVE_EVENT_KEY);
      return;
    }
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(filterByRetention(readContactItems(), days)));
    localStorage.setItem(ADDITIONS_KEY, JSON.stringify(filterByRetention(readAdditionItems(), days)));
    localStorage.setItem(ARCHIVE_EVENT_KEY, JSON.stringify(filterByRetention(readArchiveItems(), days)));
  }

  async function deleteRemoteReceived(days = null) {
    if (!supabaseClient) return false;
    let query = supabaseClient.from("site_submissions").delete();
    if (days) query = query.lt("created_at", cutoffDate(days));
    else query = query.neq("id", 0);
    const { error } = await query;
    if (error) throw error;
    return true;
  }

  async function cleanupReceived(days = null) {
    deleteLocalReceived(days);
    await deleteRemoteReceived(days);
    render();
    await renderRemoteSubmissions();
  }

  function titleFor(id) {
    return CIPHER_TITLES[id] || id;
  }

  function isStaticCipherItem(itemOrId) {
    const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
    return String(id || "").startsWith("static-");
  }

  function staticCipherItems() {
    const now = new Date().toISOString();
    return Object.entries(CIPHER_TITLES).map(([id, title]) => ({
      id: `static-${id}`,
      type: "example",
      title,
      url: STATIC_CIPHER_PROJECTS[id] || `ciphers/${id}.png`,
      status: "active",
      description: metadataDescription("", STATIC_CIPHER_TOPICS[id] || "events", "", `[image:ciphers/${id}.png]${STATIC_CIPHER_PROJECTS[id] ? `\n[project:${STATIC_CIPHER_PROJECTS[id]}]` : ""}`),
      at: "2026-07-01T00:00:00.000Z",
      updatedAt: now,
      staticCipher: true
    }));
  }

  async function seedMissingStaticCiphers(remoteItems) {
    if (!supabaseClient) return remoteItems;
    const staticItems = staticCipherItems();
    const archivedIds = new Set(
      remoteItems
        .filter((item) => item.type === "example" && (item.status === "archive" || item.status === "draft"))
        .map((item) => item.id)
    );
    const nextStaticItems = staticItems.map((item) => (
      archivedIds.has(item.id) ? { ...item, status: "archive" } : item
    ));
    await Promise.all(nextStaticItems.map((item) => upsertRemoteContent(item).catch(() => null)));
    const staticIds = new Set(nextStaticItems.map((item) => item.id));
    return [
      ...nextStaticItems,
      ...remoteItems.filter((item) => !staticIds.has(item.id))
    ];
  }

  function managedCipherItems() {
    const stored = readContentItems().filter((item) => item.type === "example" && isVaultV2Item(item));
    const archived = readLocalArchivedContent().filter((item) => (item.type === "example" || !item.type) && isVaultV2Item(item));
    const byId = new Map(staticCipherItems().map((item) => [item.id, item]));
    [...stored, ...archived].forEach((item) => {
      byId.set(item.id, {
        ...(byId.get(item.id) || {}),
        ...item,
        type: item.type || "example",
        staticCipher: isStaticCipherItem(item) || Boolean(byId.get(item.id)?.staticCipher)
      });
    });
    const items = Array.from(byId.values());
    return items.map((item) => (
      item.status === "active" && hasArchivedIdentity(item, items)
        ? { ...item, status: "archive" }
        : item
    ));
  }

  function row(title, detail) {
    const item = document.createElement("div");
    item.className = "admin-list-item";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = detail;
    item.append(strong, span);
    return item;
  }

  async function renderRemoteSubmissions() {
    if (!supabaseClient) return;
    const days = retentionDays();
    if (days && !autoCleanupDone) {
      autoCleanupDone = true;
      try {
        deleteLocalReceived(days);
        await deleteRemoteReceived(days);
      } catch {
        $("adminRetentionStatus").textContent = "המחיקה האוטומטית לא הושלמה. אפשר לנסות מחיקה ידנית.";
      }
    }
    const { data, error } = await supabaseClient
      .from("site_submissions")
      .select("id,kind,payload,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error || !Array.isArray(data)) return;

    const targets = {
      contact: "adminContactsList",
      order: "adminOrdersList",
      notification: "adminNotifyList",
      ai_guide: "adminAiGuidesList",
      interest: "adminInterestList"
    };
    Object.entries(targets).forEach(([kind, id]) => {
      const list = $(id);
      if (!list) return;
      const items = data.filter((entry) => entry.kind === kind);
      list.replaceChildren();
      if (!items.length) {
        list.append(row("אין עדיין נתונים", "נתונים חדשים מכל המכשירים יופיעו כאן."));
        return;
      }
      items.forEach((entry) => {
        const payload = entry.payload || {};
        const title = payload.topic || payload.title || payload.name || payload.contact || kind;
        const detail = [
          payload.returnTo,
          payload.contact,
          payload.message,
          payload.text,
          new Date(entry.created_at).toLocaleString("he-IL")
        ].filter(Boolean).join(" | ");
        list.append(row(String(title), detail));
      });
    });

    const notesList = $("adminNotesList");
    if (notesList) {
      const notes = data.filter((entry) => (
        entry.kind === "note"
        && entry.payload?.type !== "cipher_addition_request"
        && entry.payload?.type !== "project_archive"
      ));
      notesList.replaceChildren();
      if (!notes.length) {
        notesList.append(row("אין עדיין הערות עיון", "הערות עיון מכל המכשירים יופיעו כאן."));
      } else {
        notes.forEach((entry) => {
          const payload = entry.payload || {};
          const title = payload.title || payload.id || "הערת עיון";
          const detail = [
            payload.rating ? `דירוג: ${payload.rating}/5` : "",
            payload.text,
            payload.cipherId ? `צופן: ${payload.cipherId}` : "",
            new Date(entry.created_at).toLocaleString("he-IL")
          ].filter(Boolean).join(" | ");
          notesList.append(row(String(title), detail));
        });
      }
    }

    const additionsList = $("adminCipherAdditionsList");
    if (additionsList) {
      const additions = data.filter((entry) => entry.kind === "note" && entry.payload?.type === "cipher_addition_request");
      additionsList.replaceChildren();
      if (!additions.length) {
        additionsList.append(row("אין עדיין בקשות תוספות", "כאשר משתמש ילחץ “ראיתי תוספות”, הבקשה תופיע כאן."));
      } else {
        additions.forEach((entry) => {
          const payload = entry.payload || {};
          const title = payload.title || payload.cipherId || "בקשת תוספות לצופן";
          const detail = [
            payload.contact,
            payload.details,
            payload.projectUrl ? `קובץ: ${payload.projectUrl}` : "אין קובץ פרויקט מזוהה",
            new Date(entry.created_at).toLocaleString("he-IL")
          ].filter(Boolean).join(" | ");
          additionsList.append(row(String(title), detail));
        });
      }
    }

    const projectArchiveList = $("adminProjectArchiveList");
    if (projectArchiveList) {
      const archives = data.filter((entry) => entry.kind === "note" && entry.payload?.type === "project_archive");
      projectArchiveList.replaceChildren();
      if (!archives.length) {
        projectArchiveList.append(row("אין עדיין פרויקטים לארכיון", "שמירת תמונת צופן באתר תשמור גם פרויקט ותציג אותו כאן."));
      } else {
        archives.forEach((entry) => {
          const payload = entry.payload || {};
          const title = payload.title || payload.primary || "פרויקט צופן";
          const detail = [
            payload.primary ? `ראשית: ${payload.primary}` : "",
            payload.secondary ? `משניות: ${payload.secondary}` : "",
            Number.isFinite(payload.resultCount) ? `ממצאים: ${payload.resultCount}` : "",
            new Date(entry.created_at).toLocaleString("he-IL")
          ].filter(Boolean).join(" | ");
          projectArchiveList.append(row(String(title), detail));
        });
      }
    }

    $("adminContactCount").textContent = data.filter((entry) => entry.kind === "contact").length;
    $("adminInterestCount").textContent = data.filter((entry) => entry.kind === "interest").length;
    $("adminBackendStatus").textContent = "חיבור המנהל פעיל. הנתונים מוצגים מכל המכשירים.";
  }

  function openUploadDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(UPLOAD_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(UPLOAD_STORE_NAME)) {
          db.createObjectStore(UPLOAD_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readUploads() {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(UPLOAD_STORE_NAME, "readonly");
      const request = transaction.objectStore(UPLOAD_STORE_NAME).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }

  async function saveUpload(upload) {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(UPLOAD_STORE_NAME, "readwrite");
      transaction.objectStore(UPLOAD_STORE_NAME).put(upload);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  async function deleteUpload(id) {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(UPLOAD_STORE_NAME, "readwrite");
      transaction.objectStore(UPLOAD_STORE_NAME).delete(id);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function sendUpload(upload) {
    if (supabaseClient) {
      await assertAdminConnection();
      const safeName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${upload.category}__${Date.now()}__${safeName}`;
      const bucket = upload.category === "examples" ? "public-ciphers" : "admin-uploads";
      const { error } = await supabaseClient.storage
        .from(bucket)
        .upload(path, upload.file, { contentType: upload.type, upsert: false });
      if (error) throw error;
      const publicData = bucket === "public-ciphers"
        ? supabaseClient.storage.from(bucket).getPublicUrl(path).data
        : null;
      return { bucket, path, publicUrl: publicData?.publicUrl || "" };
    }
    if (!AUTH.uploadEndpoint) return false;
    const form = new FormData();
    form.append("id", upload.id);
    form.append("category", upload.category);
    form.append("title", upload.title);
    form.append("file", upload.file, upload.name);
    await fetch(AUTH.uploadEndpoint, { method: "POST", body: form });
    return { bucket: "", path: "", publicUrl: "" };
  }

  async function renderUploads() {
    const list = $("adminUploadsList");
    const counter = $("adminUploadCount");
    if (!list || !counter) return;
    const uploads = (await readUploads()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    counter.textContent = uploads.length;
    list.replaceChildren();
    if (!uploads.length) {
      list.append(row("אין עדיין קבצים שהועלו", "קבצים שתעלה כאן יישמרו בדפדפן הניהול. לחיבור אתר חי צריך endpoint לשרת."));
      return;
    }
    uploads.forEach((upload) => {
      const item = row(upload.title || upload.name, `${upload.category} | ${formatBytes(upload.size)} | ${new Date(upload.at).toLocaleString("he-IL")}`);
      const actions = document.createElement("div");
      actions.className = "admin-file-actions";
      const download = document.createElement("button");
      download.className = "button secondary";
      download.type = "button";
      download.textContent = "הורד";
      download.addEventListener("click", () => {
        const url = URL.createObjectURL(upload.file);
        const link = document.createElement("a");
        link.href = url;
        link.download = upload.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
      const remove = document.createElement("button");
      remove.className = "button secondary";
      remove.type = "button";
      remove.textContent = "מחק מהרשימה";
      remove.addEventListener("click", async () => {
        await deleteUpload(upload.id);
        await renderUploads();
      });
      actions.append(download, remove);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  async function renderRemoteUploads() {
    if (!supabaseClient) return;
    const list = $("adminUploadsList");
    const counter = $("adminUploadCount");
    if (!list || !counter) return;
    const buckets = ["public-ciphers", "admin-uploads"];
    const results = await Promise.all(buckets.map(async (bucket) => {
      const { data, error } = await supabaseClient.storage
        .from(bucket)
        .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      return error || !Array.isArray(data) ? [] : data.map((file) => ({ ...file, bucket }));
    }));
    const data = results.flat().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    counter.textContent = data.length;
    list.replaceChildren();
    if (!data.length) {
      list.append(row("אין עדיין קבצים", "קבצים שיועלו כאן יהיו זמינים למנהל מכל מכשיר."));
      return;
    }
    data.forEach((file) => {
      const parts = file.name.split("__");
      const category = parts.length > 2 ? parts[0] : "קובץ";
      const displayName = parts.length > 2 ? parts.slice(2).join("__") : file.name;
      const size = Number(file.metadata?.size || 0);
      const item = row(displayName, `${file.bucket} | ${category} | ${formatBytes(size)} | ${new Date(file.created_at).toLocaleString("he-IL")}`);
      const actions = document.createElement("div");
      actions.className = "admin-file-actions";

      const download = document.createElement("button");
      download.className = "button secondary";
      download.type = "button";
      download.textContent = "הורד";
      download.addEventListener("click", async () => {
        const { data: signed } = await supabaseClient.storage
          .from(file.bucket)
          .createSignedUrl(file.name, 60);
        if (signed?.signedUrl) window.open(signed.signedUrl, "_blank", "noopener");
      });

      const remove = document.createElement("button");
      remove.className = "button secondary";
      remove.type = "button";
      remove.textContent = "מחק";
      remove.addEventListener("click", async () => {
        await supabaseClient.storage.from(file.bucket).remove([file.name]);
        await renderRemoteUploads();
      });
      actions.append(download, remove);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  function contentLabel(type) {
    return {
      announcement: "הודעה באתר",
      download: "גרסה / קובץ להורדה",
      link: "קישור שימושי",
      note: "הערת מנהל"
    }[type] || type;
  }

  function statusLabel(status) {
    return {
      active: "פעיל",
      draft: "טיוטה",
      archive: "ארכיון",
      past_dates: "מאגר תאריכי עבר"
    }[status] || status || "פעיל";
  }

  function topicLabel(topic) {
    return {
      users: "צפני משתמשים",
      dates: "תאריכים",
      geula: "גאולה ומשיח",
      events: "אירועים ואומות",
      healing: "רפואה וסגולות",
      past_dates: "תאריכי עבר"
    }[topic] || topic || "אירועים ואומות";
  }

  function markerValue(text, name) {
    const match = String(text || "").match(new RegExp(`\\[${name}:([^\\]]+)\\]`));
    return match ? match[1].trim() : "";
  }

  function isVaultV2Item(item) {
    return markerValue(item?.description, "vault") === "v2";
  }

  function cleanMetadataDescription(description) {
    return String(description || "").replace(/\[(topic|expire|image|project|vault):[^\]]+\]/g, "").trim();
  }

  function metadataDescription(description, topic, expire = "", markerSource = description) {
    const clean = cleanMetadataDescription(description);
    const markers = ["[vault:v2]"];
    if (topic) markers.push(`[topic:${topic}]`);
    if (expire) markers.push(`[expire:${expire}]`);
    ["image", "project"].forEach((name) => {
      const value = markerValue(markerSource, name);
      if (value) markers.push(`[${name}:${value}]`);
    });
    return [markers.join("\n"), clean].filter(Boolean).join("\n");
  }

  function confirmCipherDetails({ title, topic, status, expireAt = "", description = "", fileName = "", isExisting = false }) {
    const action = isExisting ? "לשמור את השינוי בצופן הקיים" : "להעלות את הצופן לאוצר";
    const lines = [
      `האם כל הפרטים נכונים לפני ${action}?`,
      "",
      `שם: ${title || "ללא שם"}`,
      `נושא: ${topicLabel(topic)}`,
      `פרסום: ${statusLabel(status)}`,
      expireAt ? `תאריך ארכוב: ${expireAt}` : "תאריך ארכוב: ללא",
      fileName ? `קובץ: ${fileName}` : "קובץ: נשאר הקובץ הקיים",
      description ? `תיאור: ${description}` : "תיאור: ללא"
    ];
    return window.confirm(lines.join("\n"));
  }

  function isExpiredContent(item) {
    if (!item || item.type !== "example") return false;
    if (item.status !== "active" && item.status !== "past_dates") return false;
    const expire = markerValue(item.description, "expire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(`${expire}T00:00:00`);
    return Number.isFinite(limit.getTime()) && limit < today;
  }

  function contentPayload(item) {
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      url: item.url,
      status: item.status,
      description: item.description,
      created_at: item.at,
      updated_at: item.updatedAt
    };
  }

  async function upsertRemoteContent(item) {
    if (!supabaseClient) return;
    await assertAdminConnection();
    const { error } = await supabaseClient.from("admin_content").upsert(contentPayload(item));
    if (error) throw error;
  }

  async function deleteRemoteContent(id) {
    if (!supabaseClient) return;
    await assertAdminConnection();
    const { error } = await supabaseClient.from("admin_content").delete().eq("id", id);
    if (error) throw error;
  }

  function resetContentForm() {
    $("adminContentId").value = "";
    $("adminContentType").value = "announcement";
    $("adminContentTitle").value = "";
    $("adminContentUrl").value = "";
    $("adminContentStatus").value = "active";
    if ($("adminContentExpire")) $("adminContentExpire").value = "";
    $("adminContentDescription").value = "";
  }

  function populateUploadExisting() {
    const select = $("adminUploadExisting");
    if (!select) return;
    const current = select.value;
    select.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "צופן חדש";
    select.appendChild(blank);
    managedCipherItems()
      .sort((a, b) => String(a.title).localeCompare(String(b.title), "he"))
      .forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.title} - ${statusLabel(item.status)}`;
        select.appendChild(option);
      });
    select.value = current;
  }

  function populateCipherExisting() {
    const select = $("adminCipherExisting");
    if (!select) return;
    const current = select.value;
    select.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "צופן חדש";
    select.appendChild(blank);
    managedCipherItems()
      .sort((a, b) => String(a.title).localeCompare(String(b.title), "he"))
      .forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.title} - ${statusLabel(item.status)}`;
        select.appendChild(option);
      });
    select.value = current;
  }

  function selectedCipherItem() {
    const id = $("adminCipherExisting")?.value || "";
    if (!id) return null;
    return managedCipherItems().find((item) => item.id === id && item.type === "example") || null;
  }

  function syncCipherFormWithSelection() {
    const item = selectedCipherItem();
    const file = $("adminCipherFile");
    const submit = $("adminCipherSubmitButton");
    if (!item) {
      if (file) file.required = true;
      if (submit) submit.textContent = "העלה צופן לאוצר";
      return;
    }
    $("adminCipherTitle").value = item.title || "";
    $("adminCipherTopic").value = markerValue(item.description, "topic") || "events";
    $("adminCipherStatus").value = item.status || "active";
    $("adminCipherExpire").value = markerValue(item.description, "expire") || "";
    $("adminCipherDescription").value = cleanMetadataDescription(item.description);
    if (file) file.required = false;
    if (submit) submit.textContent = "שמור שינוי בצופן הקיים";
  }

  function storagePathFromPublicUrl(url) {
    if (!url || !supabaseClient) return "";
    try {
      const parsed = new URL(url, location.href);
      const marker = "/storage/v1/object/public/public-ciphers/";
      const index = parsed.pathname.indexOf(marker);
      if (index === -1) return "";
      return decodeURIComponent(parsed.pathname.slice(index + marker.length));
    } catch {
      return "";
    }
  }

  async function removeCipherFileIfPossible(url) {
    const path = storagePathFromPublicUrl(url);
    if (!path || !supabaseClient) return false;
    const { error } = await supabaseClient.storage.from("public-ciphers").remove([path]);
    if (error) throw error;
    return true;
  }

  async function setCipherStatus(item, status) {
    const now = new Date().toISOString();
    const current = readContentItems();
    const related = current.filter((candidate) => (
      candidate.type === "example" && (candidate.id === item.id || hasSharedIdentity(candidate, item))
    ));
    if (!related.some((candidate) => candidate.id === item.id)) related.push(item);
    const nextItems = related.map((candidate) => ({ ...candidate, type: "example", status, updatedAt: now }));
    await Promise.all(nextItems.map((next) => upsertRemoteContent(next)));
    const updatedIds = new Set(nextItems.map((next) => next.id));
    writeContentItems([...nextItems, ...current.filter((candidate) => !updatedIds.has(candidate.id) && !hasSharedIdentity(candidate, item))]);
    nextItems.forEach((next) => {
      if (status === "archive" || status === "draft") rememberLocalArchive(next);
      else forgetLocalArchive(next);
    });
    renderContentItems();
    renderCipherManager();
  }

  async function deleteCipherItem(item) {
    if (isStaticCipherItem(item)) {
      await setCipherStatus(item, "archive");
      return { removedRows: 0, removedFile: false, staticItem: true, storageError: "" };
    }
    const current = readContentItems();
    const related = current.filter((candidate) => (
      candidate.type === "example" && (candidate.id === item.id || hasSharedIdentity(candidate, item))
    ));
    if (!related.some((candidate) => candidate.id === item.id)) related.push(item);
    const deletedIds = new Set();
    await Promise.all(related.map(async (candidate) => {
      await deleteRemoteContent(candidate.id);
      deletedIds.add(candidate.id);
    }));
    writeContentItems(current.filter((candidate) => !deletedIds.has(candidate.id) && !hasSharedIdentity(candidate, item)));
    related.forEach((candidate) => forgetLocalArchive(candidate));
    let removedFile = false;
    let storageError = "";
    try {
      removedFile = await removeCipherFileIfPossible(item.url);
    } catch (error) {
      storageError = friendlyError(error) || String(error?.message || error || "");
    }
    renderContentItems();
    renderCipherManager();
    return { removedRows: deletedIds.size, removedFile, staticItem: false, storageError };
  }

  function renderCipherManager() {
    const list = $("adminCipherList");
    if (!list) return;
    const archiveList = $("adminCipherArchiveList");
    const archivePanel = $("adminCipherArchivePanel");
    const archiveToggle = $("adminCipherArchiveToggle");
    const archiveSummary = $("adminCipherArchiveSummary");
    const allItems = managedCipherItems()
      .sort((a, b) => String(b.updatedAt || b.at).localeCompare(String(a.updatedAt || a.at)));
    const items = allItems.filter((item) => item.status !== "archive" && item.status !== "draft");
    const archivedItems = allItems.filter((item) => item.status === "archive" || item.status === "draft");
    const syncArchiveToggle = () => {
      if (!archiveToggle || !archivePanel) return;
      const isOpen = archiveToggle.getAttribute("aria-expanded") === "true";
      archivePanel.hidden = !isOpen;
      archiveToggle.textContent = `${isOpen ? "סגור ארכיון" : "כניסה לארכיון"} (${archivedItems.length})`;
      if (archiveSummary) {
        archiveSummary.textContent = archivedItems.length
          ? `בארכיון יש ${archivedItems.length} צפנים. כל פעולות הארכיון נמצאות כאן.`
          : "אין כרגע צפנים בארכיון. כאשר תעביר צופן לארכיון הוא יופיע כאן לטיפול.";
      }
    };
    if (archiveToggle && archivePanel && !archiveToggle.dataset.bound) {
      archiveToggle.dataset.bound = "1";
      archiveToggle.addEventListener("click", () => {
        const isOpen = archiveToggle.getAttribute("aria-expanded") === "true";
        archiveToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
        syncArchiveToggle();
      });
    }
    syncArchiveToggle();
    list.replaceChildren();
    if (archiveList) archiveList.replaceChildren();
    populateCipherExisting();
    if (!items.length) {
      list.append(row("אין כרגע צפנים פעילים לניהול", "צפנים פעילים או תאריכי עבר יופיעו כאן. צפנים שהועברו לארכיון מופיעים ברשימת ארכיון צפנים."));
    }
    const addCipherRow = (targetList, item, isArchiveList = false) => {
      const date = item.updatedAt || item.at ? new Date(item.updatedAt || item.at).toLocaleString("he-IL") : "";
      const detail = [statusLabel(item.status), topicLabel(markerValue(item.description, "topic") || "events"), date, item.url].filter(Boolean).join(" | ");
      const line = row(item.title || "צופן ללא שם", detail);
      const actions = document.createElement("div");
      actions.className = "admin-file-actions";

      const open = document.createElement("a");
      open.className = "button secondary";
      open.href = item.url || "examples.html";
      open.target = item.url ? "_blank" : "";
      open.rel = item.url ? "noopener" : "";
      open.textContent = "פתח";

      const edit = document.createElement("button");
      edit.className = "button secondary";
      edit.type = "button";
      edit.textContent = "ערוך";
      edit.title = "טוען את נתוני הצופן לטופס כדי לתקן שם, נושא, תיאור, סטטוס או תאריך ארכוב";
      edit.addEventListener("click", () => {
        const select = $("adminCipherExisting");
        if (select) select.value = item.id;
        syncCipherFormWithSelection();
        $("adminCipherTitle")?.focus();
        $("adminCipherUploadForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
        $("adminCipherStatusText").textContent = "הצופן נטען לעריכה. אפשר לתקן נתונים וללחוץ שמור שינוי בצופן הקיים.";
      });

      const publish = document.createElement("button");
      publish.className = "button secondary";
      publish.type = "button";
      publish.textContent = isArchiveList ? "החזר לאוצר" : "פרסם";
      publish.title = isArchiveList ? "מחזיר את הצופן לאוצר הצפנים הפעיל" : "מפרסם את הצופן באוצר הפעיל";
      publish.addEventListener("click", () => setCipherStatus(item, "active"));

      const past = document.createElement("button");
      past.className = "button secondary";
      past.type = "button";
      past.textContent = "תאריכי עבר";
      past.addEventListener("click", () => setCipherStatus(item, "past_dates"));

      const archive = document.createElement("button");
      archive.className = "button secondary";
      archive.type = "button";
      archive.textContent = "ארכיון";
      archive.title = "מעביר לארכיון ומוציא מהאוצר הפעיל";
      archive.addEventListener("click", async () => {
        archive.disabled = true;
        try {
          await setCipherStatus(item, "archive");
          $("adminCipherStatusText").textContent = "הצופן הועבר לארכיון ויצא מהאוצר הפעיל.";
        } catch {
          $("adminCipherStatusText").textContent = "המעבר לארכיון נכשל. בדוק חיבור מנהל.";
        } finally {
          archive.disabled = false;
        }
      });

      const removeForever = document.createElement("button");
      removeForever.className = "button secondary danger-button";
      removeForever.type = "button";
      removeForever.textContent = isStaticCipherItem(item) ? "הסתר" : "מחק לצמיתות";
      removeForever.addEventListener("click", async () => {
        const staticItem = isStaticCipherItem(item);
        const prompt = staticItem
          ? `להסתיר את "${item.title}" מהאוצר הפעיל ולהעביר לארכיון?`
          : `למחוק לצמיתות את "${item.title}"? פעולה זו אינה הפיכה.`;
        if (!window.confirm(prompt)) return;
        removeForever.disabled = true;
        try {
          const result = await deleteCipherItem(item);
          $("adminCipherStatusText").textContent = staticItem
            ? "הצופן הקבוע הוסתר מהאוצר הפעיל ועבר לארכיון. אפשר לפרסם אותו מחדש בכל זמן."
            : result.removedFile
            ? "הצופן נמחק לצמיתות וגם קובץ האחסון נמחק."
            : result.storageError
            ? "הצופן נמחק לצמיתות מהרשימה. מחיקת קובץ האחסון לא הושלמה, אבל הוא לא יופיע באוצר."
            : "הצופן נמחק לצמיתות מהרשימה. אם הקובץ אינו באחסון הציבורי, יש למחוק אותו בנפרד לפי הצורך.";
        } catch {
          $("adminCipherStatusText").textContent = "המחיקה נכשלה. בדוק חיבור מנהל והרשאות אחסון.";
        } finally {
          removeForever.disabled = false;
        }
      });

      if (isArchiveList) {
        actions.append(open, edit, publish, past, removeForever);
      } else {
        actions.append(open, edit, publish, past, archive, removeForever);
      }
      line.appendChild(actions);
      targetList.appendChild(line);
    };
    items.forEach((item) => addCipherRow(list, item, false));
    if (archiveList) {
      if (!archivedItems.length) {
        archiveList.append(row("אין כרגע צפנים בארכיון", "לחיצה על ארכיון בצופן תעביר אותו לכאן ותוציא אותו מהאוצר הפעיל."));
      } else {
        archivedItems.forEach((item) => addCipherRow(archiveList, item, true));
      }
    }
  }

  function renderContentItems() {
    const list = $("adminContentList");
    const counter = $("adminContentCount");
    if (!list || !counter) return;
    const items = readContentItems()
      .filter((item) => item.type !== "example")
      .sort((a, b) => String(b.updatedAt || b.at).localeCompare(String(a.updatedAt || a.at)));
    counter.textContent = items.length;
    list.replaceChildren();
    if (!items.length) {
      list.append(row("אין עדיין פריטי תוכן כלליים", "כאן יופיעו הודעות, קישורים, גרסאות והערות מנהל. צפנים מנוהלים באזור אוצר הצפנים בלבד."));
      return;
    }
    items.forEach((item) => {
      const date = item.updatedAt || item.at ? new Date(item.updatedAt || item.at).toLocaleString("he-IL") : "";
      const expire = markerValue(item.description, "expire");
      const cleanDescription = cleanMetadataDescription(item.description);
      const line = row(item.title || "פריט ללא כותרת", `${contentLabel(item.type)} | ${statusLabel(item.status)}${expire ? ` | ארכוב אוטומטי: ${expire}` : ""}${item.url ? ` | ${item.url}` : ""}${date ? ` | ${date}` : ""}${cleanDescription ? ` | ${cleanDescription}` : ""}`);
      const actions = document.createElement("div");
      actions.className = "admin-file-actions";
      const edit = document.createElement("button");
      edit.className = "button secondary";
      edit.type = "button";
      edit.textContent = "ערוך";
      edit.addEventListener("click", () => {
        $("adminContentId").value = item.id;
        $("adminContentType").value = item.type || "announcement";
        $("adminContentTitle").value = item.title || "";
        $("adminContentUrl").value = item.url || "";
        $("adminContentStatus").value = item.status || "active";
        if ($("adminContentExpire")) $("adminContentExpire").value = markerValue(item.description, "expire");
        $("adminContentDescription").value = cleanMetadataDescription(item.description);
        $("adminContentTitle").focus();
      });
      const publish = document.createElement("button");
      publish.className = "button secondary";
      publish.type = "button";
      publish.textContent = "פרסם";
      publish.addEventListener("click", async () => {
        const next = { ...item, status: "active", updatedAt: new Date().toISOString() };
        writeContentItems([next, ...readContentItems().filter((candidate) => candidate.id !== item.id)]);
        await upsertRemoteContent(next);
        if (next.type === "example") forgetLocalArchive(next);
        renderContentItems();
      });
      const past = document.createElement("button");
      past.className = "button secondary";
      past.type = "button";
      past.textContent = "תאריכי עבר";
      past.addEventListener("click", async () => {
        const next = { ...item, status: "past_dates", updatedAt: new Date().toISOString() };
        writeContentItems([next, ...readContentItems().filter((candidate) => candidate.id !== item.id)]);
        await upsertRemoteContent(next);
        if (next.type === "example") forgetLocalArchive(next);
        renderContentItems();
      });
      const archive = document.createElement("button");
      archive.className = "button secondary";
      archive.type = "button";
      archive.textContent = "ארכיון";
      archive.addEventListener("click", async () => {
        const next = { ...item, status: "archive", updatedAt: new Date().toISOString() };
        writeContentItems([next, ...readContentItems().filter((candidate) => candidate.id !== item.id)]);
        await upsertRemoteContent(next);
        if (next.type === "example") rememberLocalArchive(next);
        renderContentItems();
      });
      const remove = document.createElement("button");
      remove.className = "button secondary";
      remove.type = "button";
      remove.textContent = "מחק";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`למחוק את "${item.title}" מרשימת התוכן?`)) return;
        writeContentItems(readContentItems().filter((candidate) => candidate.id !== item.id));
        await deleteRemoteContent(item.id);
        renderContentItems();
      });
      actions.append(edit, publish, past, archive, remove);
      line.appendChild(actions);
      list.appendChild(line);
    });
    populateUploadExisting();
    renderCipherManager();
  }

  function addYear(dateText) {
    if (!dateText) return "";
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  function addYearFromLater(dateText) {
    const todayText = new Date().toISOString().slice(0, 10);
    const baseText = dateText && dateText > todayText ? dateText : todayText;
    return addYear(baseText);
  }

  function generateLicenseCode() {
    const randomPart = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    return `GE-${randomPart()}-${randomPart()}-${randomPart()}`;
  }

  function resetLicenseForm() {
    $("adminLicenseId").value = "";
    $("adminLicenseEmail").value = "";
    $("adminLicenseName").value = "";
    $("adminLicenseCode").value = "";
    $("adminLicensePurchasedAt").value = new Date().toISOString().slice(0, 10);
    $("adminLicenseExpiresAt").value = addYear($("adminLicensePurchasedAt").value);
    $("adminLicenseStatus").value = "active";
    $("adminLicenseDeviceLimit").value = "2";
    $("adminLicenseNotes").value = "";
  }

  function fillLicenseForm(item) {
    $("adminLicenseId").value = item.id || "";
    $("adminLicenseEmail").value = item.email || "";
    $("adminLicenseName").value = item.purchaser_name || "";
    $("adminLicenseCode").value = item.license_code || "";
    $("adminLicensePurchasedAt").value = item.purchased_at || "";
    $("adminLicenseExpiresAt").value = item.expires_at || "";
    $("adminLicenseStatus").value = item.status || "active";
    $("adminLicenseDeviceLimit").value = item.device_limit || 2;
    $("adminLicenseNotes").value = item.notes || "";
    $("adminLicenseEmail").focus();
  }

  async function loadLicenses() {
    const list = $("adminLicenseList");
    if (!list) return;
    list.replaceChildren();
    if (!supabaseClient) {
      list.append(row("ניהול שירותים אישיים דורש חיבור מנהל", "היכנס למנהל המחובר לאתר כדי להוסיף ולעדכן הזמנות או הטבות."));
      return;
    }
    const ready = await requireAdminConnection($("adminLicenseStatusText"));
    if (!ready.ok) {
      list.append(row("אין חיבור מנהל פעיל", ready.message));
      return;
    }
    const { data, error } = await supabaseClient
      .from("purchased_update_access")
      .select("id,email,purchaser_name,license_code,purchased_at,expires_at,status,notes,device_limit,devices,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      list.append(row("רשימת השירותים עדיין לא זמינה", friendlyError(error) || "צריך להריץ פעם אחת את supabase-setup.sql המעודכן."));
      return;
    }
    if (!Array.isArray(data) || !data.length) {
      list.append(row("אין עדיין פרטי שירות", "הוסף הזמנת חיפוש אישי או הטבה בטופס שמעל הרשימה."));
      return;
    }
    data.forEach((item) => {
      const active = item.status === "active" && item.expires_at >= new Date().toISOString().slice(0, 10);
      const deviceCount = Array.isArray(item.devices) ? item.devices.length : 0;
      const line = row(
        item.email,
        `${item.purchaser_name || "ללא שם"} | ${item.purchased_at || ""} עד ${item.expires_at || ""} | ${active ? "פעיל" : "לא פעיל"} | מחשבים ${deviceCount}/${item.device_limit || 2}`
      );
      const actions = document.createElement("div");
      actions.className = "admin-file-actions";
      const edit = document.createElement("button");
      edit.className = "button secondary";
      edit.type = "button";
      edit.textContent = "ערוך";
      edit.addEventListener("click", () => fillLicenseForm(item));
      const block = document.createElement("button");
      block.className = "button secondary";
      block.type = "button";
      block.textContent = item.status === "active" ? "חסום" : "הפעל";
      block.addEventListener("click", async () => {
        block.disabled = true;
        const nextStatus = item.status === "active" ? "blocked" : "active";
        const { error: updateError } = await supabaseClient
          .from("purchased_update_access")
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        $("adminLicenseStatusText").textContent = updateError
          ? friendlyError(updateError) || "העדכון נכשל."
          : "פרטי השירות עודכנו.";
        await loadLicenses();
      });
      const renew = document.createElement("button");
      renew.className = "button secondary";
      renew.type = "button";
      renew.textContent = "הארך שנה";
      renew.title = "מאריך את תוקף השירות או ההטבה בשנה מתאריך הסיום הקיים או מהיום, המאוחר מביניהם";
      renew.addEventListener("click", async () => {
        renew.disabled = true;
        const nextExpires = addYearFromLater(item.expires_at);
        const { error: updateError } = await supabaseClient
          .from("purchased_update_access")
          .update({ status: "active", expires_at: nextExpires, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        $("adminLicenseStatusText").textContent = updateError
          ? friendlyError(updateError) || "הארכת השירות נכשלה."
          : `תוקף השירות או ההטבה הוארך עד ${nextExpires}.`;
        await loadLicenses();
      });
      actions.append(edit, renew, block);
      line.appendChild(actions);
      list.appendChild(line);
    });
  }

  function wireLicenses() {
    const form = $("adminLicenseForm");
    if (!form) return;
    const purchased = $("adminLicensePurchasedAt");
    const expires = $("adminLicenseExpiresAt");
    purchased?.addEventListener("change", () => {
      if (!expires.value || $("adminLicenseId").value === "") expires.value = addYear(purchased.value);
    });
    $("adminLicenseResetButton")?.addEventListener("click", () => {
      resetLicenseForm();
      $("adminLicenseStatusText").textContent = "";
    });
    resetLicenseForm();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $("adminLicenseStatusText");
      if (!supabaseClient) {
        status.textContent = "ניהול רישיונות זמין רק בחיבור מנהל לאתר.";
        return;
      }
      const ready = await requireAdminConnection(status);
      if (!ready.ok) return;
      const id = $("adminLicenseId").value || undefined;
      const payload = {
        email: $("adminLicenseEmail").value.trim().toLowerCase(),
        purchaser_name: $("adminLicenseName").value.trim(),
        license_code: $("adminLicenseCode").value.trim() || generateLicenseCode(),
        purchased_at: $("adminLicensePurchasedAt").value,
        expires_at: $("adminLicenseExpiresAt").value,
        device_limit: Math.max(1, Math.min(10, Number($("adminLicenseDeviceLimit").value || 2))),
        status: $("adminLicenseStatus").value,
        notes: $("adminLicenseNotes").value.trim(),
        updated_at: new Date().toISOString()
      };
      if (!payload.email || !payload.purchased_at || !payload.expires_at) return;
      status.textContent = "שומר רישיון...";
      const query = id
        ? supabaseClient.from("purchased_update_access").update(payload).eq("id", id)
        : supabaseClient.from("purchased_update_access").upsert(payload, { onConflict: "email" });
      const { error } = await query;
      if (error) {
        status.textContent = friendlyError(error) || "שמירת הרישיון נכשלה.";
        return;
      }
      status.textContent = "הרישיון נשמר.";
      resetLicenseForm();
      await loadLicenses();
    });
  }

  async function loadRemoteContent() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
      .from("admin_content")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error || !Array.isArray(data)) return;
    const now = new Date().toISOString();
    const seededData = await seedMissingStaticCiphers(data);
    const normalized = seededData.map((item) => {
      const local = {
      id: item.id,
      type: item.type,
      title: item.title,
      url: item.url,
      status: item.status,
      description: item.description,
      at: item.created_at,
      updatedAt: item.updated_at
      };
      return isExpiredContent(local) ? { ...local, status: "archive", updatedAt: now } : local;
    });
    const withLocalArchive = normalized.map((item) => (
      item.status === "active" && hasArchivedIdentity(item, normalized)
        ? { ...item, status: "archive", updatedAt: now }
        : item
    ));
    const archivedUpdates = withLocalArchive.filter((item) => (
      item.status === "archive"
      && seededData.some((source) => source.id === item.id && source.status !== "archive")
    ));
    await Promise.all(archivedUpdates.map((item) => upsertRemoteContent(item).catch(() => null)));
    writeContentItems(withLocalArchive);
    renderContentItems();
  }

  function render() {
    const store = readStore();
    const contactItems = readContactItems();
    const likes = store.likes || {};
    const reviews = store.reviews || {};
    const interestIds = Object.entries(likes).filter(([, value]) => Boolean(value)).map(([id]) => id);
    const notes = Object.entries(reviews).flatMap(([id, items]) => (
      Array.isArray(items) ? items.map((item) => ({ id, ...item })) : []
    ));

    $("adminSiteVisits").textContent = store.siteVisits || 0;
    $("adminWebUses").textContent = store.webUses || 0;
    $("adminExamplesVisits").textContent = store.examplesVisits || 0;
    $("adminInterestCount").textContent = interestIds.length;
    $("adminContactCount").textContent = contactItems.length;
    renderUploads();
    renderRemoteUploads();
    renderContentItems();

    const interestList = $("adminInterestList");
    interestList.replaceChildren();
    if (!interestIds.length) {
      interestList.append(row("אין עדיין סימוני עיון", "כאשר משתמש יסמן צופן כראוי לעיון, הוא יופיע כאן."));
    } else {
      interestIds.forEach((id) => interestList.append(row(titleFor(id), "סומן לעיון במכשיר זה")));
    }

    const notesList = $("adminNotesList");
    notesList.replaceChildren();
    if (!notes.length) {
      notesList.append(row("אין עדיין הערות עיון", "הערות קצרות על צפנים יופיעו כאן."));
    } else {
      notes.slice().reverse().forEach((note) => {
        const date = note.at ? new Date(note.at).toLocaleString("he-IL") : "";
        notesList.append(row(titleFor(note.id), `${note.text || ""}${date ? ` | ${date}` : ""}`));
      });
    }

    const additionsList = $("adminCipherAdditionsList");
    if (additionsList) {
      const additions = readAdditionItems();
      additionsList.replaceChildren();
      if (!additions.length) {
        additionsList.append(row("אין עדיין בקשות תוספות", "כאשר משתמש ילחץ “ראיתי תוספות”, הבקשה תופיע כאן."));
      } else {
        additions.slice().reverse().forEach((item) => {
          const date = item.at ? new Date(item.at).toLocaleString("he-IL") : "";
          const detail = [
            item.contact,
            item.details,
            item.projectUrl ? `קובץ: ${item.projectUrl}` : "אין קובץ פרויקט מזוהה",
            date
          ].filter(Boolean).join(" | ");
          additionsList.append(row(item.title || titleFor(item.cipherId) || "בקשת תוספות לצופן", detail));
        });
      }
    }

    const projectArchiveList = $("adminProjectArchiveList");
    if (projectArchiveList) {
      const archives = readArchiveItems();
      projectArchiveList.replaceChildren();
      if (!archives.length) {
        projectArchiveList.append(row("אין עדיין פרויקטים לארכיון", "שמירת תמונת צופן באתר תשמור גם פרויקט ותציג אותו כאן."));
      } else {
        archives.forEach((item) => {
          const date = item.at ? new Date(item.at).toLocaleString("he-IL") : "";
          const data = item.data || {};
          const detail = [
            data.primary ? `ראשית: ${data.primary}` : "",
            data.secondary ? `משניות: ${data.secondary}` : "",
            Array.isArray(data.saved) ? `ממצאים: ${data.saved.length}` : "",
            date
          ].filter(Boolean).join(" | ");
          projectArchiveList.append(row(item.name || data.primary || "פרויקט צופן", detail));
        });
      }
    }

    const notifyList = $("adminNotifyList");
    notifyList.replaceChildren();
    if (store.notifyContact) {
      notifyList.append(row("פרטי הודעה שמורים", store.notifyContact));
    } else {
      notifyList.append(row("אין נרשמים במכשיר זה", "לאחר חיבור שירות מרכזי תופיע כאן רשימת הנרשמים."));
    }

    const ordersList = $("adminOrdersList");
    if (ordersList) {
      const orders = Array.isArray(store.cipherOrders) ? store.cipherOrders : [];
      ordersList.replaceChildren();
      if (!orders.length) {
        ordersList.append(row("אין עדיין בקשות", "בקשות חיפוש צופן שיוכנו במכשיר זה יופיעו כאן."));
      } else {
        orders.slice().reverse().forEach((order) => {
          const date = order.at ? new Date(order.at).toLocaleString("he-IL") : "";
          ordersList.append(row(order.topic || "בקשת בדיקה", `${order.contact || ""}${date ? ` | ${date}` : ""}`));
        });
      }
    }

    const aiGuidesList = $("adminAiGuidesList");
    if (aiGuidesList) {
      const guides = Array.isArray(store.aiGuides) ? store.aiGuides : [];
      const decodes = Array.isArray(store.aiDecodes) ? store.aiDecodes : [];
      aiGuidesList.replaceChildren();
      if (!guides.length && !decodes.length) {
        aiGuidesList.append(row("אין עדיין עיונים שמורים", "רשימות מילים ופענוחי צפנים שיייבנו במכשיר זה יופיעו כאן."));
      } else {
        decodes.slice().reverse().forEach((decode) => {
          const date = decode.at ? new Date(decode.at).toLocaleString("he-IL") : "";
          const count = Array.isArray(decode.secondaries) ? decode.secondaries.length : 0;
          const intent = {
            who: "מי",
            where: "איפה",
            when: "מתי",
            what: "מה",
            event: "אירוע",
            general: "כללי",
          }[decode.intent] || "כללי";
          aiGuidesList.append(row(`פענוח ${intent}: ${decode.title || decode.primary || "צופן"}`, `${decode.primary || ""} | ${count} משניות${decode.question ? ` | ${decode.question}` : ""}${date ? ` | ${date}` : ""}`));
        });
        guides.slice().reverse().forEach((guide) => {
          const date = guide.at ? new Date(guide.at).toLocaleString("he-IL") : "";
          aiGuidesList.append(row(guide.topic || "עיון מונחה", `${guide.words?.length || 0} מילים${date ? ` | ${date}` : ""}`));
        });
      }
    }

    const contactsList = $("adminContactsList");
    if (contactsList) {
      contactsList.replaceChildren();
      if (!contactItems.length) {
        contactsList.append(row("אין עדיין פניות צור קשר", "פניות שיישלחו דרך צור קשר יופיעו כאן לאחר חיבור המערכת, וישמרו גם עותק מקומי לגיבוי."));
      } else {
        contactItems.slice().reverse().forEach((contact) => {
          const date = contact.at ? new Date(contact.at).toLocaleString("he-IL") : "";
          const title = `${contact.topic || "פנייה"} - ${contact.name || "ללא שם"}`;
          contactsList.append(row(title, `${contact.returnTo || ""}${date ? ` | ${date}` : ""}${contact.message ? ` | ${contact.message}` : ""}`));
        });
      }
    }

    if (supabaseClient) {
      $("adminBackendStatus").textContent = "בודק חיבור מנהל...";
      requireAdminConnection($("adminBackendStatus"));
    } else {
      $("adminBackendStatus").textContent = CONFIG.enabled && CONFIG.endpoint
        ? "חיבור נתונים מרכזי מוגדר."
        : "מצב נוכחי: נתונים מקומיים בלבד, ללא שליחה לשרת.";
    }
  }

  function exportCsv() {
    const store = readStore();
    const reviews = store.reviews || {};
    const lines = [["type", "cipher", "value", "date"]];
    Object.entries(store.likes || {}).forEach(([id, marked]) => {
      if (marked) lines.push(["interest", titleFor(id), "marked", ""]);
    });
    Object.entries(reviews).forEach(([id, items]) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => lines.push(["note", titleFor(id), item.text || "", item.at || ""]));
    });
    if (store.notifyContact) lines.push(["notify", "", store.notifyContact, ""]);
    readContactItems().forEach((item) => {
      lines.push(["contact", item.topic || "", `${item.name || ""} | ${item.returnTo || ""} | ${item.message || ""}`, item.at || ""]);
    });
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gal-einai-admin-local-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function wireUploads() {
    const form = $("adminUploadForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = $("adminUploadFile").files?.[0];
      const status = $("adminUploadStatusText");
      if (!file) return;
      const upload = {
        id: `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        category: $("adminUploadCategory").value,
        title: $("adminUploadTitle").value.trim() || file.name,
        publishStatus: $("adminUploadStatus")?.value || "active",
        topic: $("adminUploadTopic")?.value || "events",
        expireAt: $("adminUploadExpire")?.value || "",
        existingContentId: $("adminUploadExisting")?.value || "",
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        at: new Date().toISOString(),
        file
      };
      await saveUpload(upload);
      try {
        const sent = await sendUpload(upload);
        if (upload.category === "examples" && sent?.publicUrl) {
          const now = new Date().toISOString();
          const id = upload.existingContentId || `example-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const items = readContentItems();
          const existing = items.find((item) => item.id === id);
          const content = {
            id,
            type: "example",
            title: upload.title,
            url: sent.publicUrl,
            status: upload.publishStatus,
            description: metadataDescription(
              cleanMetadataDescription(existing?.description || ""),
              upload.topic,
              upload.expireAt,
              existing?.description || ""
            ),
            at: existing?.at || now,
            updatedAt: now
          };
          writeContentItems([content, ...items.filter((item) => item.id !== id)]);
          await upsertRemoteContent(content);
          renderContentItems();
        }
        status.textContent = sent
          ? upload.category === "examples"
            ? "הצופן הועלה ונוסף לרשימת הצפנים לפי הסטטוס שנבחר."
            : "הקובץ נשמר ונשלח לשרת ההעלאות."
          : "הקובץ נשמר בדפדפן הניהול, אבל לא נשלח לאתר החי.";
      } catch (error) {
        status.textContent = friendlyError(error) || "הקובץ נשמר בדפדפן, אך השליחה לאתר נכשלה. היכנס מחדש למנהל ונסה שוב.";
      }
      form.reset();
      await renderUploads();
      await renderRemoteUploads();
    });
  }

  function wireCipherManager() {
    const form = $("adminCipherUploadForm");
    if (!form) return;
    $("adminCipherExisting")?.addEventListener("change", syncCipherFormWithSelection);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = $("adminCipherFile").files?.[0];
      const status = $("adminCipherStatusText");
      status.textContent = "בודק חיבור מנהל...";
      const existingContentId = $("adminCipherExisting").value || "";
      const existingItem = selectedCipherItem();
      if (!file && existingItem) {
        const ready = await requireAdminConnection(status);
        if (!ready.ok) return;
        const now = new Date().toISOString();
        const nextTitle = $("adminCipherTitle").value.trim() || existingItem.title;
        const nextStatus = $("adminCipherStatus").value || "active";
        const nextTopic = $("adminCipherTopic").value || markerValue(existingItem.description, "topic") || "events";
        const nextExpire = $("adminCipherExpire").value || "";
        const nextDescription = $("adminCipherDescription").value.trim();
        if (!confirmCipherDetails({
          title: nextTitle,
          topic: nextTopic,
          status: nextStatus,
          expireAt: nextExpire,
          description: nextDescription,
          isExisting: true
        })) {
          status.textContent = "השמירה בוטלה. אפשר לתקן את הפרטים ולנסות שוב.";
          return;
        }
        const next = {
          ...existingItem,
          title: nextTitle,
          status: nextStatus,
          description: metadataDescription(
            nextDescription,
            nextTopic,
            nextExpire,
            existingItem.description || ""
          ),
          updatedAt: now
        };
        try {
          writeContentItems([next, ...readContentItems().filter((item) => item.id !== next.id)]);
          await upsertRemoteContent(next);
          if (next.status === "archive" || next.status === "draft") rememberLocalArchive(next);
          else forgetLocalArchive(next);
          status.textContent = next.status === "archive"
            ? "הצופן הועבר לארכיון ויצא מהאוצר הפעיל."
            : "השינוי נשמר באתר.";
          renderContentItems();
          syncCipherFormWithSelection();
        } catch (error) {
          status.textContent = friendlyError(error) || "השמירה לא הצליחה. היכנס מחדש למנהל ונסה שוב.";
        }
        return;
      }
      if (!file) {
        status.textContent = "בחר קובץ לצופן חדש, או בחר צופן קיים כדי לשנות אותו בלי קובץ.";
        return;
      }
      const ready = await requireCipherStorageReady(status);
      if (!ready.ok) {
        status.textContent = ready.message;
        return;
      }
      const title = $("adminCipherTitle").value.trim() || file.name;
      const uploadTopic = $("adminCipherTopic").value || "events";
      const uploadStatus = $("adminCipherStatus").value || "active";
      const uploadExpire = $("adminCipherExpire").value || "";
      const uploadDescription = $("adminCipherDescription").value.trim();
      if (!confirmCipherDetails({
        title,
        topic: uploadTopic,
        status: uploadStatus,
        expireAt: uploadExpire,
        description: uploadDescription,
        fileName: file.name,
        isExisting: Boolean(existingContentId)
      })) {
        status.textContent = "ההעלאה בוטלה. אפשר לתקן את הפרטים ולנסות שוב.";
        return;
      }
      const upload = {
        id: `cipher-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        category: "examples",
        title,
        publishStatus: uploadStatus,
        topic: uploadTopic,
        expireAt: uploadExpire,
        existingContentId,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        at: new Date().toISOString(),
        file
      };
      status.textContent = "מעלה את הצופן...";
      await saveUpload(upload);
      try {
        const sent = await sendUpload(upload);
        if (!sent?.publicUrl) {
          status.textContent = "הקובץ נשמר בדפדפן, אך אין כרגע חיבור העלאה פעיל לאוצר הציבורי.";
          await renderUploads();
          return;
        }
        const now = new Date().toISOString();
        const id = upload.existingContentId || `example-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const items = readContentItems();
        const existing = items.find((item) => item.id === id);
        const content = {
          id,
          type: "example",
          title,
          url: sent.publicUrl,
          status: upload.publishStatus,
          description: metadataDescription(
            uploadDescription || cleanMetadataDescription(existing?.description || ""),
            upload.topic,
            upload.expireAt,
            existing?.description || ""
          ),
          at: existing?.at || now,
          updatedAt: now
        };
        writeContentItems([content, ...items.filter((item) => item.id !== id)]);
        await upsertRemoteContent(content);
        form.reset();
        $("adminCipherTopic").value = "dates";
        $("adminCipherStatus").value = "active";
        syncCipherFormWithSelection();
        status.textContent = upload.existingContentId
          ? "הצופן הקיים עודכן באוצר הצפנים."
          : "הצופן הועלה ונוסף לאוצר הצפנים.";
        renderContentItems();
        await renderUploads();
        await renderRemoteUploads();
      } catch (error) {
        status.textContent = friendlyError(error) || "ההעלאה לא הצליחה. נסה להיכנס מחדש למנהל ואז להעלות שוב.";
      }
    });
    $("refreshCipherManagerButton")?.addEventListener("click", async () => {
      $("adminCipherStatusText").textContent = "בודק חיבור ומרענן...";
      const ready = await requireCipherStorageReady($("adminCipherStatusText"));
      if (!ready.ok) {
        $("adminCipherStatusText").textContent = ready.message;
        return;
      }
      await loadRemoteContent();
      renderCipherManager();
      $("adminCipherStatusText").textContent = "הרשימה רועננה.";
    });
  }

  function exportContentJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      content: readContentItems()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gal-einai-admin-content-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function wireContent() {
    const form = $("adminContentForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $("adminContentStatusText");
      status.textContent = "בודק חיבור מנהל...";
      const ready = await requireAdminConnection(status);
      if (!ready.ok) return;
      const now = new Date().toISOString();
      const id = $("adminContentId").value || `content-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const items = readContentItems();
      const existing = items.find((item) => item.id === id);
      const next = {
        id,
        type: $("adminContentType").value,
        title: $("adminContentTitle").value.trim(),
        url: $("adminContentUrl").value.trim(),
        status: $("adminContentStatus").value,
        description: metadataDescription(
          $("adminContentDescription").value.trim(),
          markerValue(existing?.description || "", "topic"),
          $("adminContentExpire")?.value || "",
          existing?.description || ""
        ),
        at: existing?.at || now,
        updatedAt: now
      };
      writeContentItems([next, ...items.filter((item) => item.id !== id)]);
      try {
        await upsertRemoteContent(next);
      } catch (error) {
        status.textContent = friendlyError(error) || "השמירה באתר נכשלה. היכנס מחדש למנהל ונסה שוב.";
        return;
      }
      status.textContent = "הפריט נשמר באתר.";
      resetContentForm();
      renderContentItems();
    });
    $("resetContentButton")?.addEventListener("click", () => {
      resetContentForm();
      $("adminContentStatusText").textContent = "";
    });
    $("exportContentButton")?.addEventListener("click", exportContentJson);
  }

  function wireRetention() {
    const select = $("adminRetentionSelect");
    const status = $("adminRetentionStatus");
    if (!select) return;
    select.value = retentionValue();
    select.addEventListener("change", () => {
      localStorage.setItem(RETENTION_KEY, select.value);
      autoCleanupDone = false;
      status.textContent = select.value === "manual"
        ? "המחיקה תתבצע רק בלחיצה ידנית."
        : select.value === "never"
          ? "מידע שהתקבל לא יימחק אוטומטית."
          : "ההגדרה נשמרה. בכניסה הבאה לניהול יימחק מידע ישן לפי הזמן שנבחר.";
    });
    $("adminDeleteExpiredButton")?.addEventListener("click", async () => {
      const days = retentionDays();
      if (!days) {
        status.textContent = "בחר זמן שמירה כמו שבוע, חודש או שנה כדי למחוק לפי תאריך.";
        return;
      }
      if (!window.confirm(`למחוק מידע שהתקבל לפני יותר מ-${select.options[select.selectedIndex].textContent}?`)) return;
      status.textContent = "מוחק מידע ישן...";
      try {
        await cleanupReceived(days);
        status.textContent = "המידע הישן נמחק.";
      } catch {
        status.textContent = "המחיקה נכשלה. בדוק שהכניסה לניהול מחוברת.";
      }
    });
    $("adminDeleteAllReceivedButton")?.addEventListener("click", async () => {
      if (!window.confirm("למחוק את כל המידע שהתקבל באתר? פעולה זו אינה הפיכה.")) return;
      status.textContent = "מוחק את כל המידע שהתקבל...";
      try {
        await cleanupReceived(null);
        status.textContent = "כל המידע שהתקבל נמחק.";
      } catch {
        status.textContent = "המחיקה נכשלה. בדוק שהכניסה לניהול מחוברת.";
      }
    });
  }

  if (supabaseClient) wireSupabaseAuth();
  else wireAuth();
  wirePasswordToggles();
  wireContent();
  wireUploads();
  wireCipherManager();
  wireLicenses();
  wireRetention();
  $("refreshAdminButton")?.addEventListener("click", () => {
    render();
    renderRemoteSubmissions();
    loadLicenses();
  });
  $("exportAdminButton")?.addEventListener("click", exportCsv);
  if (!supabaseClient && isAuthenticated()) render();
})();
