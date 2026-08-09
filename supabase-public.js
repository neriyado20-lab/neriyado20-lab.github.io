(() => {
  const url = "https://sxbfjouuguniegwbevwy.supabase.co";
  const key = "sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK";

  async function submit(kind, payload) {
    try {
      const response = await fetch(`${url}/rest/v1/site_submissions`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ kind, payload })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function checkFullUpdateAccess(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, active: false };
    try {
      const response = await fetch(`${url}/rest/v1/rpc/check_full_update_access`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_email: normalizedEmail })
      });
      if (!response.ok) return { ok: false, active: false };
      const data = await response.json();
      const row = Array.isArray(data) ? data[0] : data;
      return {
        ok: true,
        active: Boolean(row?.is_active),
        purchasedAt: row?.purchased_at || "",
        expiresAt: row?.expires_at || "",
        daysLeft: Number(row?.days_left ?? -1)
      };
    } catch {
      return { ok: false, active: false };
    }
  }

  window.GalEinaiBackend = Object.freeze({ submit, checkFullUpdateAccess });
})();
