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

  try {
    const token = authHeader.slice("Bearer ".length);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json(req, { error: "Invalid or expired session" }, 401);

    const body = await req.json().catch(() => ({}));
    const product = body?.product === undefined ? "messenger" : String(body.product);
    if (!["messenger", "whatsmygram", "direct"].includes(product)) {
      return json(req, { error: "Unsupported call product" }, 400);
    }
    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    if (product === "direct") {
      const peerUserId = String(body?.peerUserId || "");
      if (!isUuid(peerUserId) || peerUserId === authData.user.id) {
        return json(req, { error: "A valid direct-message peer is required" }, 400);
      }
      const relationship = await supabase.from("direct_messages").select("id")
        .or("and(sender_id.eq." + authData.user.id + ",recipient_id.eq." + peerUserId + "),and(sender_id.eq." + peerUserId + ",recipient_id.eq." + authData.user.id + ")")
        .limit(1).maybeSingle();
      if (relationship.error || !relationship.data) {
        return json(req, { error: "Send or receive a direct message before calling this user" }, 403);
      }
    } else {
      const chatId = String(body?.chatId || "");
      if (!isUuid(chatId)) return json(req, { error: "A valid private chat is required" }, 400);
      const membershipQuery = product === "whatsmygram"
        ? supabase.from("whatsmygram_chat_members").select("chat_id")
        : supabase.from("chat_members").select("chat_id");
      const { data: membership, error: membershipError } = await membershipQuery
        .eq("chat_id", chatId)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (membershipError || !membership) return json(req, { error: "Chat membership required" }, 403);
    }

    const turnKeyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID");
    const turnKey = Deno.env.get("CLOUDFLARE_TURN_KEY");
    if (!turnKeyId || !turnKey) {
      return json(req, { error: "TURN relay is not configured; direct STUN connectivity remains available" }, 503);
    }

    const upstream = await fetch(
      "https://rtc.live.cloudflare.com/v1/turn/keys/" + encodeURIComponent(turnKeyId) + "/credentials/generate-ice-servers",
      {
        method: "POST",
        headers: { authorization: "Bearer " + turnKey, "content-type": "application/json" },
        body: JSON.stringify({ ttl: 7200, customIdentifier: "mygram-" + authData.user.id.slice(0, 8) }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!upstream.ok) {
      console.error("Cloudflare TURN credential request failed with status", upstream.status);
      return json(req, { error: "TURN credentials could not be issued" }, 502);
    }
    const payload = await upstream.json();
    const iceServers = (Array.isArray(payload?.iceServers) ? payload.iceServers : []).map((server: any) => {
      const urls = (Array.isArray(server?.urls) ? server.urls : [server?.urls]).filter((url: unknown) =>
        typeof url === "string" &&
        (/^stun:stun\.cloudflare\.com(?::\d+)?$/.test(url) ||
          /^turns?:turn\.cloudflare\.com(?::\d+)?(?:\?transport=(?:udp|tcp))?$/.test(url))
      );
      return { ...server, urls };
    }).filter((server: any) => server.urls.length > 0);
    if (!iceServers.length) return json(req, { error: "TURN provider returned no usable ICE servers" }, 502);
    return json(req, { iceServers, expiresIn: 7200 });
  } catch (error) {
    console.error("turn-credentials error", error);
    return json(req, { error: "Could not obtain TURN credentials" }, 502);
  }
});
