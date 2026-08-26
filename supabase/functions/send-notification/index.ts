import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "admin@gal-einai.local";
const RESEND_URL = "https://api.resend.com/emails";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubmissionRow = {
  payload: Record<string, unknown>;
  created_at: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function envValue(name: string) {
  return String(Deno.env.get(name) || "").trim();
}

function keyFromJsonMap(value: string) {
  try {
    const keys = JSON.parse(value || "{}");
    return String(keys.default || Object.values(keys)[0] || "").trim();
  } catch {
    return "";
  }
}

function publishableKey() {
  return envValue("SUPABASE_ANON_KEY")
    || envValue("SUPABASE_PUBLISHABLE_KEY")
    || keyFromJsonMap(envValue("SUPABASE_PUBLISHABLE_KEYS"));
}

function serviceRoleKey() {
  return envValue("SUPABASE_SERVICE_ROLE_KEY")
    || envValue("SUPABASE_SECRET_KEY")
    || keyFromJsonMap(envValue("SUPABASE_SECRET_KEYS"));
}

function cleanText(value: unknown, max = 4000) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function cleanEmail(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function topicDefaults(topic: string) {
  if (topic === "software_updates") {
    return {
      subject: "גל עיני V552 זמינה להורדה",
      body: "שלום וברכה,\n\nגרסת גל עיני V552 זמינה להורדה באתר.\nהעדכון מוסיף אפשרות עדכון מתוך התוכנה לאחר הרשמה, לצד שיפורי תנועה וגרירה.\n\nלהורדה:\nhttps://neriyado20-lab.github.io/#download\n\nבברכה,\nגל עיני",
    };
  }
  return {
    subject: "צופן חדש באוצר גל עיני",
    body: "שלום וברכה,\n\nנוסף צופן חדש לאוצר גל עיני.\nאפשר לצפות באוצר הצפנים כאן:\nhttps://neriyado20-lab.github.io/examples.html\n\nבברכה,\nגל עיני",
  };
}

async function requireAdmin(request: Request, supabaseUrl: string, anonKey: string) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, error: "missing auth token" };
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error) return { ok: false, error: error.message };
  const email = String(data.user?.email || "").trim().toLowerCase();
  if (email !== ADMIN_EMAIL) return { ok: false, error: "not admin" };
  return { ok: true, email };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const supabaseUrl = envValue("SUPABASE_URL");
  const anonKey = publishableKey();
  const serviceKey = serviceRoleKey();
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Supabase function secrets are missing" }, 503);
  }

  const admin = await requireAdmin(request, supabaseUrl, anonKey);
  if (!admin.ok) return jsonResponse({ error: "admin authorization required", details: admin.error }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const topic = cleanText(payload.topic, 80) || "cipher_vault";
  if (!["software_updates", "cipher_vault"].includes(topic)) {
    return jsonResponse({ error: "unsupported topic" }, 400);
  }

  const defaults = topicDefaults(topic);
  const subject = cleanText(payload.subject, 180) || defaults.subject;
  const body = cleanText(payload.body, 6000) || defaults.body;
  const dryRun = payload.dryRun === true;

  const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await serviceClient
    .from("site_submissions")
    .select("payload,created_at")
    .eq("kind", "notification")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return jsonResponse({ error: error.message }, 500);

  const seen = new Set<string>();
  const emailContacts = (Array.isArray(data) ? data : [])
    .filter((row: SubmissionRow) => String(row.payload?.topic || "") === topic)
    .map((row: SubmissionRow) => cleanEmail(row.payload?.contact))
    .filter((email: string) => {
      if (!email || seen.has(email)) return false;
      seen.add(email);
      return true;
    });

  if (!emailContacts.length) {
    return jsonResponse({ ok: true, topic, subject, recipients: 0, sent: 0, message: "no email recipients" });
  }

  const resendKey = envValue("RESEND_API_KEY");
  const from = envValue("MAIL_FROM") || "Gal Einai <onboarding@resend.dev>";
  const rawReportTo = envValue("MAIL_REPORT_TO");
  const reportTo = cleanEmail(rawReportTo);
  if (!reportTo) {
    return jsonResponse({
      ok: false,
      code: "missing_report_to",
      error: "MAIL_REPORT_TO must be your real Resend account email",
      topic,
      subject,
      recipients: emailContacts.length,
    }, 503);
  }
  const fromEmail = cleanEmail(String(from.match(/<([^>]+)>/)?.[1] || from));
  if (fromEmail === "onboarding@resend.dev") {
    const blocked = emailContacts.filter((email) => email !== reportTo);
    if (blocked.length) {
      return jsonResponse({
        ok: false,
        code: "resend_onboarding_limit",
        error: "Resend onboarding@resend.dev can only send to the Resend account email. Verify a domain or test only with MAIL_REPORT_TO.",
        topic,
        subject,
        recipients: emailContacts.length,
        allowedRecipient: reportTo,
        blockedRecipients: blocked.length,
      }, 503);
    }
  }
  if (!resendKey) {
    return jsonResponse({
      ok: false,
      code: "missing_resend_key",
      error: "RESEND_API_KEY is not configured",
      topic,
      subject,
      recipients: emailContacts.length,
    }, 503);
  }

  if (dryRun) return jsonResponse({ ok: true, dryRun: true, topic, subject, recipients: emailContacts.length });

  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;white-space:pre-wrap">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</div>`;

  let sent = 0;
  const failures: unknown[] = [];
  for (const batch of chunk(emailContacts, 45)) {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${topic}-${Date.now()}-${batch[0]}`.slice(0, 240),
      },
      body: JSON.stringify({
        from,
        to: [reportTo],
        bcc: batch,
        subject,
        text: body,
        html,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) sent += batch.length;
    else failures.push({ status: response.status, result });
  }

  return jsonResponse({
    ok: failures.length === 0,
    topic,
    subject,
    recipients: emailContacts.length,
    sent,
    failedBatches: failures.length,
    failures: failures.slice(0, 3),
  }, failures.length ? 502 : 200);
});

