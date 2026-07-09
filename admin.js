(() => {
  const STORAGE_KEY = "gal-einai-site-interactions-v1";
  const CONTACT_STORAGE_KEY = "gal-einai-contact-v1";
  const CONTENT_STORAGE_KEY = "gal-einai-admin-content-v1";
  const ADDITIONS_KEY = "gal-einai-my-cipher-additions-v1";
  const ARCHIVE_EVENT_KEY = "gal-einai-web-archive-events-v1";
  const AUTH_SESSION_KEY = "gal-einai-admin-authenticated-v1";
  const UPLOAD_DB_NAME = "gal-einai-admin-uploads-v1";
  const UPLOAD_STORE_NAME = "files";
  const CONFIG = window.GAL_EINAI_INTERACTIONS || {};
  const AUTH = window.GAL_EINAI_ADMIN_AUTH || {};
  const supabaseClient = AUTH.supabaseUrl && AUTH.supabasePublishableKey && window.supabase
    ? window.supabase.createClient(AUTH.supabaseUrl, AUTH.supabasePublishableKey)
    : null;
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

  function setAuthenticated(value) {
    if (value) sessionStorage.setItem(AUTH_SESSION_KEY, "yes");
    else sessionStorage.removeItem(AUTH_SESSION_KEY);
    document.body.classList.toggle("admin-locked", !value);
    document.body.classList.toggle("admin-unlocked", value);
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
    const logoutButton = $("adminLogoutButton");
    const forgotButton = $("adminForgotPasswordButton");
    const status = $("adminLoginStatus");
    const { data } = await supabaseClient.auth.getSession();
    setAuthenticated(Boolean(data.session));
    if (data.session) {
      render();
      renderRemoteSubmissions();
      loadRemoteContent();
    }

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
    });

    forgotButton?.addEventListener("click", async () => {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(AUTH.supabaseAdminEmail, {
        redirectTo: `${location.origin}${location.pathname}`
      });
      status.textContent = error
        ? "לא הצלחתי לשלוח איפוס. אם כתובת המנהל אינה אימייל אמיתי, יש לקבוע סיסמה חדשה ב-Supabase > Authentication > Users."
        : "נשלח קישור איפוס סיסמה לאימייל המנהל, אם מוגדרת שליחת אימייל ב-Supabase.";
    });

    logoutButton?.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      setAuthenticated(false);
      $("adminLoginPassword").value = "";
      $("adminLoginCode").focus();
    });
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

  function titleFor(id) {
    return CIPHER_TITLES[id] || id;
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
          const detail = [payload.text, new Date(entry.created_at).toLocaleString("he-IL")].filter(Boolean).join(" | ");
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
    $("adminBackendStatus").textContent = "מחובר ל-Supabase. הנתונים מוצגים מכל המכשירים.";
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
      const safeName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${upload.category}__${Date.now()}__${safeName}`;
      const { error } = await supabaseClient.storage
        .from("admin-uploads")
        .upload(path, upload.file, { contentType: upload.type, upsert: false });
      if (error) throw error;
      return true;
    }
    if (!AUTH.uploadEndpoint) return false;
    const form = new FormData();
    form.append("id", upload.id);
    form.append("category", upload.category);
    form.append("title", upload.title);
    form.append("file", upload.file, upload.name);
    await fetch(AUTH.uploadEndpoint, { method: "POST", body: form });
    return true;
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
    const { data, error } = await supabaseClient.storage
      .from("admin-uploads")
      .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error || !Array.isArray(data)) return;

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
      const item = row(displayName, `${category} | ${formatBytes(size)} | ${new Date(file.created_at).toLocaleString("he-IL")}`);
      const actions = document.createElement("div");
      actions.className = "admin-file-actions";

      const download = document.createElement("button");
      download.className = "button secondary";
      download.type = "button";
      download.textContent = "הורד";
      download.addEventListener("click", async () => {
        const { data: signed } = await supabaseClient.storage
          .from("admin-uploads")
          .createSignedUrl(file.name, 60);
        if (signed?.signedUrl) window.open(signed.signedUrl, "_blank", "noopener");
      });

      const remove = document.createElement("button");
      remove.className = "button secondary";
      remove.type = "button";
      remove.textContent = "מחק";
      remove.addEventListener("click", async () => {
        await supabaseClient.storage.from("admin-uploads").remove([file.name]);
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
      example: "צופן לדוגמה / צופן משתמש",
      link: "קישור שימושי",
      note: "הערת מנהל"
    }[type] || type;
  }

  function resetContentForm() {
    $("adminContentId").value = "";
    $("adminContentType").value = "announcement";
    $("adminContentTitle").value = "";
    $("adminContentUrl").value = "";
    $("adminContentStatus").value = "active";
    $("adminContentDescription").value = "";
  }

  function renderContentItems() {
    const list = $("adminContentList");
    const counter = $("adminContentCount");
    if (!list || !counter) return;
    const items = readContentItems().sort((a, b) => String(b.updatedAt || b.at).localeCompare(String(a.updatedAt || a.at)));
    counter.textContent = items.length;
    list.replaceChildren();
    if (!items.length) {
      list.append(row("אין עדיין פריטי תוכן", "כאן יופיעו הודעות, קישורים, גרסאות, דוגמאות והערות מנהל."));
      return;
    }
    items.forEach((item) => {
      const date = item.updatedAt || item.at ? new Date(item.updatedAt || item.at).toLocaleString("he-IL") : "";
      const line = row(item.title || "פריט ללא כותרת", `${contentLabel(item.type)} | ${item.status || "active"}${item.url ? ` | ${item.url}` : ""}${date ? ` | ${date}` : ""}${item.description ? ` | ${item.description}` : ""}`);
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
        $("adminContentDescription").value = item.description || "";
        $("adminContentTitle").focus();
      });
      const remove = document.createElement("button");
      remove.className = "button secondary";
      remove.type = "button";
      remove.textContent = "מחק";
      remove.addEventListener("click", () => {
        writeContentItems(readContentItems().filter((candidate) => candidate.id !== item.id));
        renderContentItems();
      });
      actions.append(edit, remove);
      line.appendChild(actions);
      list.appendChild(line);
    });
  }

  async function loadRemoteContent() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
      .from("admin_content")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error || !Array.isArray(data)) return;
    writeContentItems(data.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      url: item.url,
      status: item.status,
      description: item.description,
      at: item.created_at,
      updatedAt: item.updated_at
    })));
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
      aiGuidesList.replaceChildren();
      if (!guides.length) {
        aiGuidesList.append(row("אין עדיין עיוני AI", "רשימות מילים שייבנו במכשיר זה יופיעו כאן."));
      } else {
        guides.slice().reverse().forEach((guide) => {
          const date = guide.at ? new Date(guide.at).toLocaleString("he-IL") : "";
          aiGuidesList.append(row(guide.topic || "עיון AI", `${guide.words?.length || 0} מילים${date ? ` | ${date}` : ""}`));
        });
      }
    }

    const contactsList = $("adminContactsList");
    if (contactsList) {
      contactsList.replaceChildren();
      if (!contactItems.length) {
        contactsList.append(row("אין עדיין פניות צור קשר", "פניות שנשמרו בדף צור קשר במכשיר זה יופיעו כאן."));
      } else {
        contactItems.slice().reverse().forEach((contact) => {
          const date = contact.at ? new Date(contact.at).toLocaleString("he-IL") : "";
          const title = `${contact.topic || "פנייה"} - ${contact.name || "ללא שם"}`;
          contactsList.append(row(title, `${contact.returnTo || ""}${date ? ` | ${date}` : ""}${contact.message ? ` | ${contact.message}` : ""}`));
        });
      }
    }

    $("adminBackendStatus").textContent = CONFIG.enabled && CONFIG.endpoint
      ? "חיבור נתונים מרכזי מוגדר."
      : "מצב נוכחי: נתונים מקומיים בלבד, ללא שליחה לשרת.";
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
      const status = $("adminUploadStatus");
      if (!file) return;
      const upload = {
        id: `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        category: $("adminUploadCategory").value,
        title: $("adminUploadTitle").value.trim() || file.name,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        at: new Date().toISOString(),
        file
      };
      await saveUpload(upload);
      try {
        const sent = await sendUpload(upload);
        status.textContent = sent
          ? "הקובץ נשמר ונשלח לשרת ההעלאות."
          : "הקובץ נשמר בדפדפן הניהול. לחיבור העלאה אמיתית לאתר צריך להגדיר uploadEndpoint.";
      } catch {
        status.textContent = "הקובץ נשמר בדפדפן, אך השליחה לשרת נכשלה.";
      }
      form.reset();
      await renderUploads();
      await renderRemoteUploads();
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
        description: $("adminContentDescription").value.trim(),
        at: existing?.at || now,
        updatedAt: now
      };
      writeContentItems([next, ...items.filter((item) => item.id !== id)]);
      if (supabaseClient) {
        await supabaseClient.from("admin_content").upsert({
          id: next.id,
          type: next.type,
          title: next.title,
          url: next.url,
          status: next.status,
          description: next.description,
          created_at: next.at,
          updated_at: next.updatedAt
        });
      }
      $("adminContentStatusText").textContent = "הפריט נשמר.";
      resetContentForm();
      renderContentItems();
    });
    $("resetContentButton")?.addEventListener("click", () => {
      resetContentForm();
      $("adminContentStatusText").textContent = "";
    });
    $("exportContentButton")?.addEventListener("click", exportContentJson);
  }

  if (supabaseClient) wireSupabaseAuth();
  else wireAuth();
  wireContent();
  wireUploads();
  $("refreshAdminButton").addEventListener("click", () => {
    render();
    renderRemoteSubmissions();
  });
  $("exportAdminButton").addEventListener("click", exportCsv);
  if (!supabaseClient && isAuthenticated()) render();
})();
