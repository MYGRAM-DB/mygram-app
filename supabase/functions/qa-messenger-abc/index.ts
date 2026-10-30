import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const PROJECT_REF = "cbyvtehvaojxfcgpelir";
const BUCKET = "messenger-attachments";
const TOKEN_TTL_SECONDS = 300;
const REALTIME_TIMEOUT_MS = 12000;
const PNG = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
), (char) => char.charCodeAt(0));

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server runtime configuration: ${name}`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitForChannel(
  client: SupabaseClient,
  topic: string,
  onInsert?: () => void,
) {
  const channel = client.channel(topic, { config: { private: true } });
  let insertSeen = false;
  let resolveInsert: ((value: boolean) => void) | undefined;
  const insertPromise = new Promise<boolean>((resolve) => {
    resolveInsert = resolve;
    setTimeout(() => resolve(false), 10000);
  });

  channel.on("broadcast", { event: "INSERT" }, () => {
    insertSeen = true;
    resolveInsert?.(true);
    onInsert?.();
  });

  const status = await new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve("TIMEOUT"), REALTIME_TIMEOUT_MS);
    channel.subscribe((value) => {
      if (value === "SUBSCRIBED" || value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") {
        clearTimeout(timer);
        resolve(value);
      }
    });
  });

  return {
    channel,
    status,
    async waitForInsert() {
      return insertSeen || await insertPromise;
    },
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const url = new URL(request.url);
  const challenge = url.searchParams.get("challenge") ?? "";
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    return json({ ok: false, error: "INVALID_OR_MISSING_ONE_TIME_CHALLENGE" }, 401);
  }

  let admin: SupabaseClient;
  let publicKey: string;
  const apiUrl = requireEnv("SUPABASE_URL");
  assert(new URL(apiUrl).hostname === `${PROJECT_REF}.supabase.co`, "This QA runner is locked to MYGRAM-STAGING.");

  const secretDictionary = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const secretKey = secretDictionary.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  assert(secretKey, "No server-side Supabase admin key is available.");
  const publicDictionary = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  publicKey = publicDictionary.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  assert(publicKey, "No Supabase publishable key is available.");

  admin = createClient(apiUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const tokenHash = await sha256(challenge);
  const now = new Date().toISOString();
  const { data: consumed, error: consumeError } = await admin
    .from("qa_run_challenges")
    .update({ consumed_at: now })
    .eq("token_hash", tokenHash)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("token_hash")
    .limit(1);

  if (consumeError || !consumed || consumed.length !== 1) {
    return json({ ok: false, error: "CHALLENGE_EXPIRED_USED_OR_INVALID" }, 401);
  }

  const runId = crypto.randomUUID();
  const userPrefix = `qa-${runId.replaceAll("-", "")}`;
  const accounts = [
    { label: "A", email: `${userPrefix}-a@example.com`, password: `${crypto.randomUUID()}Aa9!` },
    { label: "B", email: `${userPrefix}-b@example.com`, password: `${crypto.randomUUID()}Bb8!` },
    { label: "C", email: `${userPrefix}-c@example.com`, password: `${crypto.randomUUID()}Cc7!` },
  ];
  const createdUserIds: string[] = [];
  const clients = new Map<string, SupabaseClient>();
  const channelHandles: Array<{ channel: ReturnType<SupabaseClient["channel"]> }> = [];
  let conversationId: string | null = null;
  let objectPath: string | null = null;
  let cleanupComplete = false;
  const checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> = [];

  try {
    for (const account of accounts) {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { mygram_qa_run: runId, role_hint: "ephemeral-test-only" },
      });
      assert(!error && data.user, `AUTH_ADMIN_CREATE_USER_FAILED_${account.label}`);
      createdUserIds.push(data.user.id);
    }

    const signedIn = new Map<string, { client: SupabaseClient; userId: string; token: string }>();
    for (const account of accounts) {
      const client = createClient(apiUrl, publicKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      assert(!error && data.session && data.user, `REAL_JWT_SIGN_IN_FAILED_${account.label}`);
      clients.set(account.label, client);
      signedIn.set(account.label, {
        client,
        userId: data.user.id,
        token: data.session.access_token,
      });
      await client.realtime.setAuth(data.session.access_token);
    }

    const a = signedIn.get("A")!;
    const b = signedIn.get("B")!;
    const c = signedIn.get("C")!;
    assert(new Set([a.userId, b.userId, c.userId]).size === 3, "AUTH_USERS_NOT_DISTINCT");
    checks.push({ name: "three_independent_real_jwt_sessions", status: "PASS", detail: "A, B, and C authenticated through Supabase Auth password grant." });

    const [userLow, userHigh] = [a.userId, b.userId].sort();
    const { data: conversation, error: conversationError } = await a.client
      .from("messenger_conversations")
      .insert({ user_low: userLow, user_high: userHigh, created_by: a.userId })
      .select("id")
      .single();
    assert(!conversationError && conversation?.id, "A_COULD_NOT_CREATE_DIRECT_CONVERSATION");
    conversationId = conversation.id as string;
    checks.push({ name: "a_creates_direct_conversation_with_b", status: "PASS", detail: "A created a direct conversation; the membership trigger populated exactly A and B." });

    const topic = `messenger:${conversationId}:messages`;
    const realtimeA = await waitForChannel(a.client, topic);
    const realtimeB = await waitForChannel(b.client, topic);
    const realtimeC = await waitForChannel(c.client, topic);
    channelHandles.push({ channel: realtimeA.channel }, { channel: realtimeB.channel }, { channel: realtimeC.channel });

    assert(realtimeA.status === "SUBSCRIBED", `A_REALTIME_SUBSCRIPTION_FAILED_${realtimeA.status}`);
    assert(realtimeB.status === "SUBSCRIBED", `B_REALTIME_SUBSCRIPTION_FAILED_${realtimeB.status}`);
    assert(realtimeC.status !== "SUBSCRIBED" && realtimeC.status !== "TIMEOUT" && realtimeC.status !== "TIMED_OUT", `C_REALTIME_SUBSCRIPTION_NOT_DENIED_${realtimeC.status}`);
    checks.push({ name: "private_realtime_membership", status: "PASS", detail: `A=${realtimeA.status}; B=${realtimeB.status}; C=${realtimeC.status}.` });

    const clientMessageA = crypto.randomUUID();
    const clientMessageB = crypto.randomUUID();
    const { data: messageA, error: messageAError } = await a.client
      .from("messenger_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: a.userId,
        client_message_id: clientMessageA,
        message_type: "text",
        body: "Temporary MYGRAM A/B/C isolation test message.",
      })
      .select("id")
      .single();
    assert(!messageAError && messageA?.id, "A_COULD_NOT_SEND_MESSAGE");

    const broadcastSeen = await realtimeB.waitForInsert();
    assert(broadcastSeen, "B_DID_NOT_RECEIVE_REALTIME_BROADCAST_FROM_A_MESSAGE");

    const { data: messageB, error: messageBError } = await b.client
      .from("messenger_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: b.userId,
        client_message_id: clientMessageB,
        message_type: "text",
        body: "Temporary MYGRAM B/A reply.",
      })
      .select("id")
      .single();
    assert(!messageBError && messageB?.id, "B_COULD_NOT_SEND_MESSAGE");
    checks.push({ name: "a_and_b_send_and_realtime_delivery", status: "PASS", detail: "A and B sent messages; B received A's private Realtime broadcast." });

    const { data: participantRows, error: participantError } = await b.client
      .from("messenger_participants")
      .select("user_id")
      .eq("conversation_id", conversationId);
    assert(!participantError && participantRows?.length === 2, "B_DID_NOT_SEE_EXACTLY_TWO_PARTICIPANTS");

    const { data: bMessages, error: bMessagesError } = await b.client
      .from("messenger_messages")
      .select("id,sender_id")
      .eq("conversation_id", conversationId);
    assert(!bMessagesError && bMessages?.length === 2, "B_CANNOT_READ_BOTH_MESSAGES");

    const { data: cConversation, error: cConversationError } = await c.client
      .from("messenger_conversations").select("id").eq("id", conversationId);
    assert(!cConversationError && cConversation?.length === 0, "C_CAN_READ_A_B_CONVERSATION");

    const { data: cParticipants, error: cParticipantsError } = await c.client
      .from("messenger_participants").select("user_id").eq("conversation_id", conversationId);
    assert(!cParticipantsError && cParticipants?.length === 0, "C_CAN_READ_A_B_MEMBERSHIP");

    const { data: cMessages, error: cMessagesError } = await c.client
      .from("messenger_messages").select("id").eq("conversation_id", conversationId);
    assert(!cMessagesError && cMessages?.length === 0, "C_CAN_READ_A_B_MESSAGES");
    checks.push({ name: "rest_membership_isolation", status: "PASS", detail: "B reads exactly two members and two messages; C receives zero conversation, membership, and message rows." });

    const { error: spoofError } = await c.client
      .from("messenger_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: a.userId,
        client_message_id: crypto.randomUUID(),
        message_type: "text",
        body: "C spoof attempt must be denied.",
      });
    assert(spoofError, "C_SPOOFED_A_AS_MESSAGE_SENDER");

    const { error: selfAddError } = await c.client
      .from("messenger_participants")
      .insert({ conversation_id: conversationId, user_id: c.userId, role: "member" });
    assert(selfAddError, "C_ADDED_ITSELF_TO_CONVERSATION");
    checks.push({ name: "membership_and_sender_spoof_denied", status: "PASS", detail: "C cannot spoof A as sender or add itself to participants." });

    objectPath = `${conversationId}/${a.userId}/qa-${runId}.png`;
    const { error: uploadError } = await a.client.storage.from(BUCKET).upload(objectPath, PNG, {
      contentType: "image/png",
      upsert: false,
    });
    assert(!uploadError, "A_COULD_NOT_UPLOAD_PRIVATE_ATTACHMENT");

    const { error: metadataError } = await a.client.from("messenger_attachments").insert({
      conversation_id: conversationId,
      message_id: messageA.id,
      uploaded_by: a.userId,
      object_path: objectPath,
      mime_type: "image/png",
      byte_size: PNG.byteLength,
    });
    assert(!metadataError, "A_COULD_NOT_CREATE_ATTACHMENT_METADATA");

    const { data: bAttachment, error: bAttachmentError } = await b.client
      .from("messenger_attachments").select("id,object_path").eq("conversation_id", conversationId);
    assert(!bAttachmentError && bAttachment?.length === 1, "B_CANNOT_READ_ATTACHMENT_METADATA");

    const { data: bDownload, error: bDownloadError } = await b.client.storage.from(BUCKET).download(objectPath);
    assert(!bDownloadError && bDownload, "B_CANNOT_DOWNLOAD_PRIVATE_ATTACHMENT");

    const { data: cAttachment, error: cAttachmentError } = await c.client
      .from("messenger_attachments").select("id").eq("conversation_id", conversationId);
    assert(!cAttachmentError && cAttachment?.length === 0, "C_CAN_READ_ATTACHMENT_METADATA");

    const { data: cDownload, error: cDownloadError } = await c.client.storage.from(BUCKET).download(objectPath);
    assert(cDownloadError && !cDownload, "C_CAN_DOWNLOAD_PRIVATE_ATTACHMENT");
    checks.push({ name: "private_storage_and_attachment_metadata", status: "PASS", detail: "A uploads; B reads metadata and downloads; C sees zero metadata and cannot download." });

    const { data: cCreatedConversation, error: cCreateError } = await c.client
      .from("messenger_conversations")
      .insert({ user_low: userLow, user_high: userHigh, created_by: c.userId })
      .select("id");
    assert(cCreateError || (cCreatedConversation?.length ?? 0) === 0, "C_CREATED_A_CONVERSATION_FOR_A_AND_B");
    checks.push({ name: "unauthorized_conversation_creation_denied", status: "PASS", detail: "C cannot create a conversation whose two members are A and B." });

    await Promise.all(channelHandles.map(({ channel }) => channel.unsubscribe()));
    channelHandles.length = 0;

    checks.push({ name: "test_data_cleanup", status: "PASS", detail: "Cleanup is executed in finally; result confirmed after all deletion calls." });
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "UNKNOWN_QA_RUNNER_ERROR";
    checks.push({ name: "messenger_abc_test", status: "FAIL", detail: safeMessage });
  } finally {
    await Promise.allSettled(channelHandles.map(({ channel }) => channel.unsubscribe()));

    if (objectPath) {
      await admin.storage.from(BUCKET).remove([objectPath]).catch(() => ({ error: true }));
    }
    if (conversationId) {
      await admin.from("messenger_conversations").delete().eq("id", conversationId);
    }
    for (const userId of createdUserIds.reverse()) {
      await admin.auth.admin.deleteUser(userId);
    }

    const remaining = await admin.from("messenger_conversations")
      .select("id", { count: "exact", head: true })
      .eq("id", conversationId ?? "00000000-0000-0000-0000-000000000000");
    cleanupComplete = !remaining.error && (remaining.count ?? 0) === 0;
    const cleanup = checks.find((check) => check.name === "test_data_cleanup");
    if (cleanup) {
      cleanup.status = cleanupComplete ? "PASS" : "FAIL";
      cleanup.detail = cleanupComplete
        ? "Temporary conversation and its cascaded rows were removed; Storage object removal and Auth user deletion were attempted."
        : "The temporary conversation is still present or could not be verified as deleted.";
    }
  }

  const passed = checks.filter((check) => check.status === "PASS").length;
  const failed = checks.filter((check) => check.status === "FAIL").length;
  return json({
    ok: failed === 0 && cleanupComplete,
    project: PROJECT_REF,
    suite: "MYGRAM Messenger A/B/C real JWT + REST + Storage + Realtime",
    total_checks: checks.length,
    passed,
    failed,
    cleanup_complete: cleanupComplete,
    checks,
  }, failed === 0 && cleanupComplete ? 200 : 500);
});
