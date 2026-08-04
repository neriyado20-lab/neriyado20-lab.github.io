(() => {
  const config = window.GAL_EINAI_PAYMENTS || {};
  const params = new URLSearchParams(window.location.search);
  const requestedPlan = params.get("plan") === "annual" ? "annual" : "monthly";
  const source = params.get("source") || "";
  const reason = params.get("reason") || "";
  const status = document.getElementById("paymentStatus");
  const support = document.getElementById("paymentSupport");
  const introTitle = document.querySelector(".purchase-intro h1");
  const introText = document.querySelector(".purchase-intro p:last-child");

  function selectPlan(plan) {
    document.querySelectorAll("[data-plan]").forEach((card) => {
      card.classList.toggle("selected", card.dataset.plan === plan);
    });
    const selected = config[plan] || {};
    document.getElementById("selectedPlan").textContent = selected.name || "גל עיני מקצועית";
    document.getElementById("selectedPrice").textContent = `${selected.price || 0} ₪ ${selected.period || ""}`;
    const payButton = document.getElementById("payButton");
    payButton.dataset.plan = plan;
    payButton.disabled = !config.enabled || !selected.paymentUrl;
    payButton.textContent = payButton.disabled ? "הסליקה תיפתח בקרוב" : "מעבר מאובטח לתשלום";
  }

  document.querySelectorAll("[data-plan]").forEach((card) => {
    card.addEventListener("click", () => selectPlan(card.dataset.plan));
  });

  document.getElementById("payButton").addEventListener("click", (event) => {
    const selected = config[event.currentTarget.dataset.plan] || {};
    if (config.enabled && selected.paymentUrl) window.location.assign(selected.paymentUrl);
  });

  if (source === "guided_decode") {
    if (introTitle) introTitle.textContent = "הפעלת עיון מונחה";
    if (introText) introText.textContent = "כדי לקבל כלי עיון מורחבים לאחר סריקת הצופן, יש להפעיל מסלול תשלום/קרדיט. לאחר התשלום חוזרים לצופן וממשיכים בעבודה.";
  }

  status.textContent = config.enabled
    ? `התשלום מתבצע בעמוד המאובטח של ${config.provider || "חברת הסליקה"}.`
    : source === "guided_decode" && reason === "quota"
      ? "עיון מונחה דורש תשלום/קרדיט פעיל. מערכת הרכישה מוכנה, אך החיוב עדיין כבוי עד לפתיחת חשבון הסליקה."
      : "מערכת הרכישה מוכנה באתר, אך החיוב עדיין כבוי עד לפתיחת חשבון הסליקה.";
  support.textContent = config.supportEmail
    ? `לתמיכה ברכישה: ${config.supportEmail}`
    : "כתובת התמיכה תוצג לפני פתיחת החיוב.";
  selectPlan(requestedPlan);
})();
