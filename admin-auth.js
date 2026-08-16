(() => {
  const AUTH_SESSION_KEY = "gal-einai-admin-authenticated-v1";
  const AUTH = window.GAL_EINAI_ADMIN_AUTH || {};
  const supabaseClient = AUTH.supabaseUrl && AUTH.supabasePublishableKey && window.supabase
    ? window.supabase.createClient(AUTH.supabaseUrl, AUTH.supabasePublishableKey)
    : null;

  const $ = (id) => document.getElementById(id);

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function setAuthenticated(value) {
    if (value) sessionStorage.setItem(AUTH_SESSION_KEY, "yes");
    else sessionStorage.removeItem(AUTH_SESSION_KEY);
    document.body.classList.toggle("admin-locked", !value);
    document.body.classList.toggle("admin-unlocked", value);
  }

  function wirePasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      const input = $(button.dataset.passwordToggle);
      if (!input || button.dataset.authToggleWired === "yes") return;
      button.dataset.authToggleWired = "yes";
      button.addEventListener("click", (event) => {
        event.preventDefault();
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

  function friendlyAuthError(error) {
    const message = String(error?.message || error?.error_description || error || "").trim();
    if (/network|fetch|failed to fetch|timeout/i.test(message)) return "הדפדפן לא הצליח להתחבר לשרת. בדוק אינטרנט או סינון.";
    return message || "הפעולה לא הושלמה.";
  }

  function showLogin(message = "") {
    const loginForm = $("adminLoginForm");
    const resetForm = $("adminPasswordResetForm");
    if (loginForm) loginForm.hidden = false;
    if (resetForm) resetForm.hidden = true;
    const status = $("adminLoginStatus");
    if (status) status.textContent = message;
  }

  function showPasswordReset(message = "") {
    const loginForm = $("adminLoginForm");
    const resetForm = $("adminPasswordResetForm");
    if (loginForm) loginForm.hidden = true;
    if (resetForm) resetForm.hidden = false;
    const status = $("adminPasswordResetStatus");
    if (status) status.textContent = message;
    $("adminNewPassword")?.focus();
  }

  function isPasswordRecoveryUrl() {
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    return params.get("type") === "recovery" || params.get("reset") === "admin" || params.has("code") || hash.get("type") === "recovery";
  }

  function recoveryCodeFromUrl() {
    return new URLSearchParams(location.search).get("code") || "";
  }

  function recoveryTokensFromHash() {
    const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    return {
      access_token: hash.get("access_token") || "",
      refresh_token: hash.get("refresh_token") || "",
      type: hash.get("type") || ""
    };
  }

  function clearRecoveryUrl() {
    if (history.replaceState) history.replaceState(null, document.title, `${location.origin}${location.pathname}`);
  }

  async function handleLogin(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = $("adminLoginStatus");
    const code = $("adminLoginCode")?.value.trim() || "";
    const password = $("adminLoginPassword")?.value || "";
    if (!code || !password) {
      status.textContent = "יש להזין קוד ניהול וסיסמה.";
      return;
    }
    const codeHash = await sha256(code);
    if (codeHash !== AUTH.codeHash) {
      status.textContent = "קוד או סיסמה שגויים.";
      return;
    }
    if (supabaseClient) {
      status.textContent = "בודק כניסה...";
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: AUTH.supabaseAdminEmail,
        password
      });
      if (!error) {
        status.textContent = "";
        setAuthenticated(true);
        location.reload();
        return;
      }
    }
    const passwordHash = await sha256(password);
    if (passwordHash !== AUTH.passwordHash) {
      status.textContent = "קוד או סיסמה שגויים.";
      return;
    }
    status.textContent = "";
    setAuthenticated(true);
    location.reload();
  }

  async function handleForgot(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = $("adminLoginStatus");
    if (!supabaseClient) {
      status.textContent = "איפוס סיסמה דורש חיבור Supabase פעיל. אם הסקריפט נחסם, יש לקבוע סיסמה חדשה בלוח Supabase.";
      return;
    }
    if (!adminEmailLooksDeliverable()) {
      status.textContent = "איפוס במייל אינו פעיל כי כתובת המנהל אינה כתובת מייל אמיתית. צריך להגדיר כתובת מנהל אמיתית ב-Supabase.";
      return;
    }
    status.textContent = "שולח קישור איפוס...";
    const { error } = await supabaseClient.auth.resetPasswordForEmail(AUTH.supabaseAdminEmail, {
      redirectTo: `${location.origin}${location.pathname}?reset=admin`
    });
    status.textContent = error
      ? `לא הצלחתי לשלוח איפוס: ${friendlyAuthError(error)}`
      : "נשלח קישור איפוס סיסמה לאימייל המנהל.";
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = $("adminPasswordResetStatus");
    if (!supabaseClient) {
      status.textContent = "שמירת סיסמה חדשה דורשת חיבור Supabase פעיל.";
      return;
    }
    const password = $("adminNewPassword")?.value || "";
    const confirm = $("adminNewPasswordConfirm")?.value || "";
    if (password.length < 6) {
      status.textContent = "הסיסמה צריכה להכיל לפחות 6 תווים.";
      return;
    }
    if (password !== confirm) {
      status.textContent = "שתי הסיסמאות אינן זהות.";
      return;
    }
    status.textContent = "שומר סיסמה חדשה...";
    const session = await ensureRecoverySession();
    if (!session) {
      status.textContent = "קישור האיפוס אינו פעיל יותר. שלח קישור איפוס חדש ופתח אותו מאותו דפדפן.";
      return;
    }
    const email = session.user?.email || "";
    if (String(email).trim().toLowerCase() !== String(AUTH.supabaseAdminEmail).trim().toLowerCase()) {
      status.textContent = "קישור האיפוס אינו שייך לחשבון המנהל.";
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      status.textContent = `לא הצלחתי לשמור סיסמה חדשה: ${friendlyAuthError(error)}`;
      return;
    }
    clearRecoveryUrl();
    await supabaseClient.auth.signOut();
    setAuthenticated(false);
    showLogin("הסיסמה החדשה נשמרה. כעת אפשר להיכנס עם קוד המנהל והסיסמה החדשה.");
  }

  async function ensureRecoverySession() {
    if (!supabaseClient) return null;
    const { data: current } = await supabaseClient.auth.getSession();
    if (current.session) return current.session;
    const code = recoveryCodeFromUrl();
    if (code && supabaseClient.auth.exchangeCodeForSession) {
      const flowId = new URLSearchParams(location.search).get("sb_flow_id");
      const { data, error } = await supabaseClient.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined
      );
      if (!error && data.session) return data.session;
    }
    const tokens = recoveryTokensFromHash();
    if (tokens.access_token && tokens.refresh_token && supabaseClient.auth.setSession) {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      });
      if (!error && data.session) return data.session;
    }
    return null;
  }

  function wire() {
    wirePasswordToggles();
    $("adminLoginForm")?.addEventListener("submit", handleLogin, true);
    $("adminForgotPasswordButton")?.addEventListener("click", handleForgot, true);
    $("adminPasswordResetForm")?.addEventListener("submit", handlePasswordReset, true);
    $("adminBackToLoginButton")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearRecoveryUrl();
      showLogin("");
    }, true);
    if (isPasswordRecoveryUrl()) {
      setAuthenticated(false);
      showPasswordReset("הכנס סיסמה חדשה לחשבון המנהל.");
      ensureRecoverySession().then((session) => {
        const status = $("adminPasswordResetStatus");
        if (!status) return;
        status.textContent = session
          ? "הכנס סיסמה חדשה לחשבון המנהל."
          : "קישור האיפוס נפתח, אבל עדיין לא נוצרה התחברות שחזור. אם השמירה לא תצליח, שלח קישור איפוס חדש ופתח אותו מיד.";
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, { once: true });
  else wire();
})();
