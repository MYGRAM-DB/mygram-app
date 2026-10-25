// Supabase Edge Function: translate-text
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// MYGRAM_TRANSLATION_API_URL, MYGRAM_TRANSLATION_API_KEY, MYGRAM_TRANSLATION_MODEL.
// Provider keys stay in Edge Function secrets, never in browser config.js.
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
type Item = { key: string; text: string };

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

  let body: { text?: string; key?: string; items?: Item[]; sourceLocale?: string; targetLocale?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const sourceLocale = String(body.sourceLocale ?? "auto");
  const targetLocale = String(body.targetLocale ?? "");
  const items: Item[] = Array.isArray(body.items)
    ? body.items.map((item) => ({ key: String(item?.key ?? ""), text: String(item?.text ?? "").trim() }))
    : [{ key: String(body.key ?? "translation"), text: String(body.text ?? "").trim() }];
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(targetLocale) || targetLocale === sourceLocale) {
    if (sourceLocale !== "auto" || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(targetLocale)) {
      return json({ error: "Invalid language pair" }, 400);
    }
  }
  if (!items.length || items.length > 80 || items.some((item) => !item.key || item.key.length > 80 || !item.text || item.text.length > 1000)) {
    return json({ error: "Send 1 to 80 keyed text items, each up to 1000 characters" }, 400);
  }
  if (new Set(items.map((item) => item.key)).size !== items.length) return json({ error: "Duplicate item keys" }, 400);
  if (items.reduce((sum, item) => sum + item.text.length, 0) > 12000) return json({ error: "Batch text is too large" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: locale, error: localeError } = await admin.from("supported_locales")
    .select("code").eq("code", targetLocale).eq("enabled", true).maybeSingle();
  if (localeError || !locale) return json({ error: "Target language is not enabled" }, 400);

  const keys = new Map<string, string>();
  for (const item of items) keys.set(item.key, await sha256([sourceLocale, targetLocale, item.text].join("\u0000")));
  const cacheHashes = [...keys.values()];
  const { data: cachedRows, error: cacheReadError } = await admin.from("translation_cache")
    .select("cache_key,translated_text").in("cache_key", cacheHashes);
  if (cacheReadError) return json({ error: "Translation cache unavailable" }, 503);
  const cache = new Map((cachedRows ?? []).map((row) => [row.cache_key, row.translated_text]));
  const translations: Record<string, string> = {};
  const missing: Item[] = [];
  for (const item of items) {
    const value = cache.get(keys.get(item.key)!);
    if (value) translations[item.key] = value;
    else missing.push(item);
  }
  if (!missing.length) return json({ translations, cached: true, provider: "cache" });

  const { data: quotaAllowed, error: quotaError } = await admin.rpc("consume_translation_quota", {
    p_user_id: user.id, p_max_per_hour: 30,
  });
  if (quotaError) {
    console.error("Translation quota check failed", quotaError.message);
    return json({ error: "Translation service temporarily unavailable" }, 503);
  }
  if (quotaAllowed !== true) return json({ error: "Translation rate limit reached. Try again later." }, 429);

  try {
    const response = await fetch(providerUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${providerKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Translate each value accurately from ${sourceLocale} to ${targetLocale}. Return only valid JSON in the form {"translations":{"same_key":"translated text"}}. Preserve meaning, names, URLs, placeholders such as {name}, HTML tags, and emoji. Do not translate keys. Do not mix languages unless the source contains a proper name or unavoidable brand name. Use natural, region-appropriate wording.` },
          { role: "user", content: JSON.stringify({ translations: Object.fromEntries(missing.map((item) => [item.key, item.text])) }) },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) return json({ error: "Translation provider failed", providerStatus: response.status }, 502);
    const result = await response.json();
    const raw = result?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const translatedMap = parsed?.translations;
    if (!translatedMap || typeof translatedMap !== "object") return json({ error: "Invalid translation response" }, 502);
    const now = new Date().toISOString();
    const cacheRows = [];
    for (const item of missing) {
      const translatedText = String(translatedMap[item.key] ?? "").trim();
      if (!translatedText || translatedText.length > 4000) return json({ error: "Incomplete translation response" }, 502);
      translations[item.key] = translatedText;
      cacheRows.push({
        cache_key: keys.get(item.key), source_locale: sourceLocale, target_locale: targetLocale,
        source_text: item.text, translated_text: translatedText, provider: "ai", model_name: model,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    const { error: cacheWriteError } = await admin.from("translation_cache").upsert(cacheRows);
    if (cacheWriteError) console.error("Translation cache write failed", cacheWriteError.message);
    return json({ translations, cached: false, provider: "ai", model, translatedCount: missing.length });
  } catch (error) {
    console.error("Translation request failed", error);
    return json({ error: "Translation service temporarily unavailable" }, 502);
  }
});
