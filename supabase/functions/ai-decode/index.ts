const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function compact(value: unknown, max = 16000) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n...` : text;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 503);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const secondaries = Array.isArray(payload.secondaries) ? payload.secondaries : [];
  if (!secondaries.length) {
    return jsonResponse({ error: "no actual scan findings were provided" }, 400);
  }

  const prompt = [
    "אתה מסייע בפענוח זהיר של צופן תורה לאחר סריקה בפועל.",
    "כלל מחייב: התייחס רק למילים ולנתונים שנמסרו כאן. אל תוסיף מילה שלא נמצאה בפועל.",
    "אין לקבוע נבואה, ודאות, אשמה, פסול או הכרעה על אדם.",
    "כתוב בעברית מסודרת, בסעיפים קצרים: ממצאים מרכזיים, קשר לשאלה, חיזוקים, חולשות/מה חסר, בדיקות המשך.",
    "אם אין מספיק נתונים, אמור זאת בפירוש.",
    "",
    `שם הצופן: ${payload.title || ""}`,
    `שאלה מנחה: ${payload.question || ""}`,
    `ראשית: ${payload.primary || ""}`,
    "תיק ממצאים מסריקת האתר:",
    compact({
      intent: payload.intent,
      secondaries: payload.secondaries,
      dates: payload.dates,
      buckets: payload.buckets,
      structure: payload.structure,
      context: payload.context,
    }),
    "",
    "תיק הפענוח שנבנה באתר:",
    compact(payload.prompt || "", 9000),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1",
      input: prompt,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "OpenAI request failed";
    const code = data?.error?.code || "";
    if (response.status === 429 && (code === "insufficient_quota" || String(message).includes("quota"))) {
      return jsonResponse({ error: "נדרש תשלום או קרדיט להפעלת פענוח AI חי", code: "insufficient_quota" }, 402);
    }
    return jsonResponse({ error: message }, 502);
  }

  const text = data.output_text
    || (Array.isArray(data.output)
      ? data.output.flatMap((item: Record<string, unknown>) => Array.isArray(item.content) ? item.content : [])
        .map((content: Record<string, unknown>) => content.text || content.output_text || "")
        .filter(Boolean)
        .join("\n")
      : "");

  return jsonResponse({ text: String(text || "").trim() });
});
