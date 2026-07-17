(() => {
  const SUPABASE_URL = "https://sxbfjouuguniegwbevwy.supabase.co";
  const SUPABASE_KEY = "sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK";
  const ADDITIONS_KEY = "gal-einai-my-cipher-additions-v1";
  const client = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  const $ = (id) => document.getElementById(id);
  const form = $("accountForm");
  const emailInput = $("accountEmail");
  const passwordInput = $("accountPassword");
  const status = $("accountStatus");
  const stateTitle = $("accountStateTitle");
  const stateText = $("accountStateText");
  const signOut = $("accountSignOutButton");
  const additionsList = $("accountAdditionsList");
  const adminVaultButton = $("accountAdminVaultButton");

  function setStatus(text) {
    status.textContent = text;
  }

  function isAdminEmail(email) {
    const adminEmail = window.GAL_EINAI_ADMIN_AUTH?.supabaseAdminEmail || "admin@gal-einai.local";
    return String(email || "").trim().toLowerCase() === String(adminEmail).trim().toLowerCase();
  }

  function setSignedIn(email) {
    const admin = isAdminEmail(email);
    stateTitle.textContent = email ? `שלום, ${email}` : "אפשר לעבוד גם בלי חשבון";
    stateText.textContent = admin
      ? "נכנסת כמנהל."
      : email
      ? "נכנסת לאזור האישי. כאן אפשר לעקוב אחרי בקשות תוספות לצפנים וקבצים להמשך עבודה."
      : "כלי החיפוש נשאר פתוח בלי כניסה. משתמש נכנס רק כשהוא רוצה לראות דברים פרטיים שלו.";
    signOut.hidden = !email;
    if (adminVaultButton) adminVaultButton.hidden = !admin;
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

  function readAdditions() {
    try {
      const raw = localStorage.getItem(ADDITIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function renderAdditions() {
    if (!additionsList) return;
    const items = readAdditions().slice().reverse();
    additionsList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent = "עדיין לא נשלחו בקשות תוספות לצפנים מהמכשיר הזה.";
      additionsList.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const box = document.createElement("article");
      box.className = "account-item";
      const title = document.createElement("strong");
      title.textContent = item.title || "צופן";
      const details = document.createElement("span");
      const date = item.at ? new Date(item.at).toLocaleString("he-IL") : "";
      details.textContent = `${item.details || ""}${date ? ` | ${date}` : ""}`;
      box.append(title, details);
      if (item.projectUrl) {
        const link = document.createElement("a");
        link.className = "button secondary";
        link.href = item.projectUrl;
        link.textContent = "פתח קובץ להמשך עבודה";
        box.appendChild(link);
      } else {
        const waiting = document.createElement("small");
        waiting.textContent = "ממתין לצירוף קובץ פרויקט על ידי המנהל.";
        box.appendChild(waiting);
      }
      additionsList.appendChild(box);
    });
  }

  async function refreshSession() {
    if (!client) return;
    const { data } = await client.auth.getSession();
    setSignedIn(data.session?.user?.email || "");
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      setStatus("החיבור לחשבון אינו פעיל כרגע.");
      return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("האימייל או הסיסמה אינם נכונים, או שהחשבון עדיין לא הופעל.");
      return;
    }
    setStatus("נכנסת בהצלחה.");
    passwordInput.value = "";
    await refreshSession();
  });

  $("accountSignUpButton")?.addEventListener("click", async () => {
    if (!client) {
      setStatus("החיבור לחשבון אינו פעיל כרגע.");
      return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || password.length < 6) {
      setStatus("יש להזין אימייל וסיסמה של לפחות 6 תווים.");
      return;
    }
    const { error } = await client.auth.signUp({ email, password });
    if (error) {
      setStatus("לא הצלחתי ליצור חשבון. ייתכן שהחשבון כבר קיים.");
      return;
    }
    setStatus("ההרשמה נקלטה. אם נדרש אישור אימייל, יש לאשר דרך ההודעה שתישלח.");
  });

  $("accountForgotButton")?.addEventListener("click", async () => {
    if (!client) {
      setStatus("איפוס סיסמה אינו פעיל כרגע.");
      return;
    }
    const email = emailInput.value.trim();
    if (!email) {
      setStatus("יש להזין אימייל ואז ללחוץ שוב על איפוס סיסמה.");
      emailInput.focus();
      return;
    }
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}`,
    });
    setStatus(error
      ? "לא הצלחתי לשלוח קישור איפוס. צריך לבדוק שהאימייל קיים ושאימות אימייל מוגדר ב-Supabase."
      : "נשלח קישור איפוס סיסמה לאימייל, אם החשבון קיים.");
  });

  signOut?.addEventListener("click", async () => {
    if (client) await client.auth.signOut();
    setSignedIn("");
    setStatus("יצאת מהאזור האישי.");
  });

  wirePasswordToggles();
  refreshSession();
  renderAdditions();
})();
