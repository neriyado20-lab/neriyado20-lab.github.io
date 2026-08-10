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
    document.getElementById("selectedPlan").textContent = selected.name || "שירות אישי בגל עיני";
    document.getElementById("selectedPrice").textContent = selected.price ? `${selected.price} ₪ ${selected.period || ""}` : "לפי תיאום";
    const payButton = document.getElementById("payButton");
    payButton.dataset.plan = plan;
    payButton.disabled = !config.enabled || !selected.paymentUrl;
    payButton.textContent = payButton.disabled ? "תיאום השירות ייפתח בקרוב" : "מעבר מאובטח לתשלום";
  }

  document.querySelectorAll("[data-plan]").forEach((card) => {
    card.addEventListener("click", () => selectPlan(card.dataset.plan));
  });

  document.getElementById("payButton").addEventListener("click", (event) => {
    const selected = config[event.currentTarget.dataset.plan] || {};
    if (config.enabled && selected.paymentUrl) window.location.assign(selected.paymentUrl);
  });

  if (source === "guided_decode") {
    if (introTitle) introTitle.textContent = "הזמנת עיון מונחה";
    if (introText) introText.textContent = "עיון מונחה הוא שירות אישי נלווה ואינו חלק מעצם התוכנה החינמית. לאחר תיאום השירות חוזרים לצופן וממשיכים בעבודה.";
  }

  status.textContent = config.enabled
    ? `התשלום מתבצע בעמוד המאובטח של ${config.provider || "חברת הסליקה"}.`
    : source === "guided_decode" && reason === "quota"
      ? "עיון מונחה הוא שירות אישי נלווה. התיאום עדיין כבוי עד לפתיחת אפשרות השירות באתר."
      : "תיאום השירות עדיין כבוי עד לפתיחת אפשרות השירות באתר.";
  support.textContent = config.supportEmail
    ? `לתמיכה בשירות אישי: ${config.supportEmail}`
    : "כתובת התמיכה תוצג לפני פתיחת השירות.";
  selectPlan(requestedPlan);
})();
