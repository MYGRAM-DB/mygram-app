import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function encodeJson(value: unknown) {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}
async function createLiveKitToken(apiKey: string, apiSecret: string, userId: string, name: string, room: string, isAdmin: boolean) {
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
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      ...(isAdmin ? { roomAdmin: true } : {}),
    },
  });
  const message = header + "." + payload;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return message + "." + b64url(signature);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed" }, 403);
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !supabaseKey) return json(req, { error: "Supabase function environment is not configured" }, 503);
  const liveKitUrl = Deno.env.get("LIVEKIT_URL");
  const liveKitApiKey = Deno.env.get("LIVEKIT_API_KEY");
  const liveKitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  if (!liveKitUrl || !liveKitApiKey || !liveKitApiSecret) {
    return json(req, { error: "Video calling is not configured yet. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET as Supabase Edge Function secrets." }, 503);
  }
  try {
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const token = authHeader.slice("Bearer ".length);
    const auth = await userClient.auth.getUser(token);
    if (auth.error || !auth.data.user) return json(req, { error: "Invalid or expired session" }, 401);
    const body = await req.json().catch(() => ({}));
    const meetingId = String(body?.meetingId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(meetingId)) {
      return json(req, { error: "Invalid meeting ID" }, 400);
    }
    const meetingResult = await userClient.from("meetings")
      .select("id,title,created_by,chair_user_id,status,video_provider")
      .eq("id", meetingId).maybeSingle();
    if (meetingResult.error || !meetingResult.data) return json(req, { error: "Meeting not found or not accessible" }, 404);
    const meeting = meetingResult.data;
    if (meeting.status !== "live") return json(req, { error: "Start the meeting before joining its video room." }, 409);
    if (meeting.video_provider === "disabled") return json(req, { error: "Video calling has been disabled for this meeting." }, 409);
    const membership = await userClient.from("meeting_participants")
      .select("meeting_id,user_id,left_at,role")
      .eq("meeting_id", meetingId).eq("user_id", auth.data.user.id).is("left_at", null).maybeSingle();
    if (membership.error || !membership.data) return json(req, { error: "Only active meeting participants can join video." }, 403);
    const name = String(auth.data.user.user_metadata?.full_name || auth.data.user.user_metadata?.username || auth.data.user.email || "MYGRAM member");
    const isAdmin = meeting.created_by === auth.data.user.id || meeting.chair_user_id === auth.data.user.id;
    const roomName = "mygram-meeting-" + meetingId;
    const signedToken = await createLiveKitToken(liveKitApiKey, liveKitApiSecret, auth.data.user.id, name, roomName, isAdmin);
    return json(req, { url: liveKitUrl, token: signedToken, room: roomName, expiresIn: 3600 });
  } catch (error) {
    console.error("meetings-token error", error);
    return json(req, { error: "Could not create a meeting video token" }, 500);
  }
});