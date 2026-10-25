import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://mygram-db.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function json(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("origin") || "";
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "origin",
  });
  if (allowedOrigins.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(value: unknown) {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function createLiveKitToken(apiKey: string, apiSecret: string, userId: string, name: string, room: string, role: "host" | "viewer") {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson({
    iss: apiKey,
    sub: userId,
    name: name.slice(0, 100),
    nbf: now - 10,
    iat: now,
    exp: now + 3600,
    jti: crypto.randomUUID(),
    video: {
      roomJoin: true,
      room,
      canPublish: role === "host",
      canSubscribe: true,
      canPublishData: role === "host",
    },
  });
  const message = header + "." + payload;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return message + "." + base64url(signature);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed" }, 403);

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !supabaseKey) return json(req, { error: "Supabase function environment is not configured" }, 503);

  const liveKitUrl = Deno.env.get("LIVEKIT_URL");
  const liveKitApiKey = Deno.env.get("LIVEKIT_API_KEY");
  const liveKitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  if (!liveKitUrl || !liveKitApiKey || !liveKitApiSecret) {
    return json(req, { error: "LiveKit is not configured yet. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET as Supabase Edge Function secrets." }, 503);
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json(req, { error: "Invalid or expired session" }, 401);

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "");
    const role = body?.role === "host" ? "host" : body?.role === "viewer" ? "viewer" : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) || !role) {
      return json(req, { error: "Invalid live session or role" }, 400);
    }

    const { data: liveSession, error: sessionError } = await supabase
      .from("live_sessions")
      .select("id,user_id,title,status")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError || !liveSession) return json(req, { error: "Live session not found or not accessible" }, 404);
    if (role === "host" && liveSession.user_id !== authData.user.id) return json(req, { error: "Only the session owner can publish" }, 403);
    if (role === "host" && !["scheduled", "live"].includes(liveSession.status)) return json(req, { error: "This session has ended" }, 409);
    if (role === "viewer" && liveSession.status !== "live") return json(req, { error: "This broadcast is not live" }, 409);

    const name = String(authData.user.user_metadata?.full_name || authData.user.user_metadata?.username || authData.user.email || "MYGRAM member");
    const roomToken = await createLiveKitToken(liveKitApiKey, liveKitApiSecret, authData.user.id, name, sessionId, role as "host" | "viewer");
    return json(req, { url: liveKitUrl, token: roomToken, room: sessionId, role, expiresIn: 3600 });
  } catch (error) {
    console.error("livekit-token error", error);
    return json(req, { error: "Could not create a live session token" }, 500);
  }
});
