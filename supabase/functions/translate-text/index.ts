// Supabase Edge Function: translate-text
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// MYGRAM_TRANSLATION_API_URL, MYGRAM_TRANSLATION_API_KEY, MYGRAM_TRANSLATION_MODEL.
// Keep provider keys in Edge Function secrets, never in browser config.js.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const providerUrl = Deno.env.get("MYGRAM_TRANSLATION_API_URL");
  const providerKey = Deno.env.get("MYGRAM_TRANSLATION_API_KEY");
  const model = Deno.env.get("MYGRAM_TRANSLATION_MODEL") ?? "gpt-4o-mini";
  if (!supabaseUrl || !anonKey || !serviceKey || !providerUrl || !providerKey) {
    return json({ error: "Translation service is not configured" }, 503);
  }
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign-in required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Invalid session" }, 401);

  let body: { text?: string; sourceLocale?: string; targetLocale?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const text = String(body.text ?? "").trim();
  const sourceLocale = String(body.sourceLocale ?? "auto");
  const targetLocale = String(body.targetLocale ?? "");
  if (!text || text.length > 5000) return json({ error: "Text must contain 1 to 5000 characters" }, 400);
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(targetLocale) || targetLocale === sourceLocale) {
    return json({ error: "Invalid or identical language pair" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: locale, error: localeError } = await admin.from("supported_locales")
    .select("code").eq("code", targetLocale).eq("enabled", true).maybeSingle();
  if (localeError || !locale) return json({ error: "Target language is not enabled" }, 400);

  const cacheKey = await sha256([sourceLocale, targetLocale, text].join("\u0000"));
  const { data: cached } = await admin.from("translation_cache").select("translated_text,provider,model_name")
    .eq("cache_key", cacheKey).maybeSingle();
  if (cached) return json({ translatedText: cached.translated_text, cached: true, provider: cached.provider });

  try {
    const response = await fetch(providerUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${providerKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `Translate accurately from ${sourceLocale} to ${targetLocale}. Preserve meaning, names, URLs, placeholders such as {name}, HTML tags, and emoji. Return only the translation, with no commentary. Use natural, region-appropriate wording.` },
          { role: "user", content: text },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) return json({ error: "Translation provider failed", providerStatus: response.status }, 502);
    const result = await response.json();
    const translatedText = String(result?.choices?.[0]?.message?.content ?? "").trim();
    if (!translatedText || translatedText.length > 10000) return json({ error: "Invalid translation response" }, 502);
    const { error: cacheError } = await admin.from("translation_cache").upsert({
      cache_key: cacheKey, source_locale: sourceLocale, target_locale: targetLocale,
      source_text: text, translated_text: translatedText, provider: "ai", model_name: model,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (cacheError) console.error("Translation cache write failed", cacheError.message);
    return json({ translatedText, cached: false, provider: "ai", model });
  } catch (error) {
    console.error("Translation request failed", error);
    return json({ error: "Translation service temporarily unavailable" }, 502);
  }
});
