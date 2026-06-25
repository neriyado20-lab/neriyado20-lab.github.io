(() => {
  const config = window.GAL_EINAI_PAYMENTS || {};
  const params = new URLSearchParams(window.location.search);
  const requestedPlan = params.get("plan") === "annual" ? "annual" : "monthly";
  const status = document.getElementById("paymentStatus");
  const support = document.getElementById("paymentSupport");

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

  status.textContent = config.enabled
    ? `התשלום מתבצע בעמוד המאובטח של ${config.provider || "חברת הסליקה"}.`
    : "מערכת הרכישה מוכנה באתר, אך החיוב עדיין כבוי עד לפתיחת חשבון הסליקה.";
  support.textContent = config.supportEmail
    ? `לתמיכה ברכישה: ${config.supportEmail}`
    : "כתובת התמיכה תוצג לפני פתיחת החיוב.";
  selectPlan(requestedPlan);
})();
