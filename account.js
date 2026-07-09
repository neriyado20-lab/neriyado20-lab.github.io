(() => {
  const SUPABASE_URL = "https://sxbfjouuguniegwbevwy.supabase.co";
  const SUPABASE_KEY = "sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK";
  const client = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  const $ = (id) => document.getElementById(id);
  const form = $("accountForm");
  const emailInput = $("accountEmail");
  const passwordInput = $("accountPassword");
  const status = $("accountStatus");
  const stateTitle = $("accountStateTitle");
  const stateText = $("accountStateText");
  const signOut = $("accountSignOutButton");

  function setStatus(text) {
    status.textContent = text;
  }

  function setSignedIn(email) {
    stateTitle.textContent = email ? `שלום, ${email}` : "אפשר לעבוד גם בלי חשבון";
    stateText.textContent = email
      ? "נכנסת לאזור האישי. בשלב הבא יהיה אפשר לחבר לכאן שמירת צפנים, הזמנות והעדפות."
      : "כלי החיפוש פתוח לציבור. חשבון אישי יעזור בהמשך לשמור פעולות, הזמנות והעדפות בין מכשירים.";
    signOut.hidden = !email;
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
      setStatus("יש להזין אימייל ואז ללחוץ שוב על שכחתי סיסמה.");
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

  refreshSession();
})();
