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

  async function aiDecode(payload) {
    const response = await fetch(`${url}/functions/v1/ai-decode`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "פענוח AI חי אינו זמין כרגע");
    }
    return data;
  }

  window.GalEinaiBackend = Object.freeze({ submit, aiDecode });
})();
