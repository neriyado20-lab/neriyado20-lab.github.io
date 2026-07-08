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

  window.GalEinaiBackend = Object.freeze({ submit });
})();
