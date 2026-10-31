import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { extractBearerToken, isTrustedStagingWorkflowClaims } from "../_shared/github-oidc-policy.mjs";

const PROJECT_REF = "cbyvtehvaojxfcgpelir";
const BUCKET = "messenger-attachments";
const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const OIDC_AUDIENCE = "mygram-staging-qa";
const OIDC_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
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
  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const oidcToken = extractBearerToken(request.headers.get("authorization") ?? "");
  if (!oidcToken) return json({ ok: false, error: "GITHUB_OIDC_TOKEN_REQUIRED" }, 401);

  let claims: Record<string, unknown>;
  try {
    const verified = await jwtVerify(oidcToken, OIDC_JWKS, {
      issuer: OIDC_ISSUER,
      audience: OIDC_AUDIENCE,
      algorithms: ["RS256"],
    });
    claims = verified.payload as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "GITHUB_OIDC_TOKEN_INVALID" }, 401);
  }

  if (!isTrustedStagingWorkflowClaims(claims)) {
    return json({ ok: false, error: "GITHUB_WORKFLOW_IDENTITY_NOT_ALLOWLISTED" }, 403);
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

  const tokenHash = await sha256(oidcToken);
  const now = new Date().toISOString();
  const expiry = new Date(Number(claims.exp) * 1000).toISOString();
  await admin.from("qa_run_challenges").delete().lt("expires_at", now);
  const { error: replayError } = await admin.from("qa_run_challenges").insert({
    token_hash: tokenHash,
    expires_at: expiry,
    consumed_at: now,
  });
  if (replayError) {
    return json({ ok: false, error: "GITHUB_OIDC_TOKEN_REPLAYED_OR_REJECTED" }, 409);
  }

  const runId = crypto.randomUUID();
  const userPrefix = `qa-${runId.replaceAll("-", "")}`;
  const accounts = [
    { label: "A", email: `${userPrefix}-a@example.com`, password: `${crypto.randomUUID()}Aa9!` },
    { label: "B", email: `${userPrefix}-b@example.com`, password: `${crypto.randomUUID()}Bb8!` },
    { label: "C", email: `${userPrefix}-c@example.com`, password: `${crypto.randomUUID()}Cc7!` },
  ];
  const createdUserIds: string[] = [];
  const profileAvatarPaths: string[] = [];
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

    const { data: ownProfileState, error: profileStateError } = await a.client.rpc("get_my_profile_state");
    assert(!profileStateError && ownProfileState?.id === a.userId, "A_PROFILE_STATE_RPC_DID_NOT_RETURN_OWN_ID");

    const { data: publicProfileB, error: publicProfileError } = await a.client
      .from("public_profiles").select("*").eq("id", b.userId).single();
    assert(!publicProfileError && publicProfileB?.id === b.userId, "SAFE_PUBLIC_PROFILE_VIEW_NOT_AVAILABLE");
    assert(
      !("study_place" in publicProfileB) &&
      !("work_place" in publicProfileB) &&
      !("profile_completed" in publicProfileB),
      "PUBLIC_PROFILE_PROJECTION_CONTAINS_PRIVATE_COLUMNS",
    );
    checks.push({ name: "real_jwt_profile_state_and_public_projection", status: "PASS", detail: "A's profile-state RPC returns only A's identity; B's safe public projection excludes private study/work/completion fields." });

    const avatarPath = `${a.userId}/qa-${runId}-avatar.png`;
    profileAvatarPaths.push(avatarPath);
    const { error: avatarUploadError } = await a.client.storage.from("profile-avatars").upload(avatarPath, PNG, {
      contentType: "image/png",
      upsert: false,
    });
    assert(!avatarUploadError, "A_OWN_PROFILE_AVATAR_UPLOAD_FAILED");
    const { data: ownerAvatar, error: ownerAvatarError } = await a.client.storage.from("profile-avatars").download(avatarPath);
    assert(!ownerAvatarError && ownerAvatar, "A_CANNOT_READ_OWN_PROFILE_AVATAR");
    const { data: cAvatar, error: cAvatarError } = await c.client.storage.from("profile-avatars").download(avatarPath);
    assert(cAvatarError && !cAvatar, "C_DOWNLOADED_A_PRIVATE_PROFILE_AVATAR");
    checks.push({ name: "real_jwt_profile_avatar_storage_isolation", status: "PASS", detail: "A uploads and downloads its own synthetic avatar; C cannot download it." });

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

    const cleanupErrors: string[] = [];

    async function cleanupAttempt(
      name: string,
      operation: () => PromiseLike<{ error: unknown | null }>,
    ) {
      try {
        const result = await operation();
        if (result.error) cleanupErrors.push(name);
      } catch {
        cleanupErrors.push(name);
      }
    }

    // Isolate deletion attempts: one timeout or rejected request must not
    // prevent cleanup of the remaining temporary QA resources.
    await Promise.all([
      ...(profileAvatarPaths.length > 0 ? [cleanupAttempt(
        "PROFILE_AVATAR_STORAGE_DELETE_FAILED",
        () => admin.storage.from("profile-avatars").remove(profileAvatarPaths),
      )] : []),
      ...(objectPath ? [cleanupAttempt(
        "STORAGE_OBJECT_DELETE_FAILED",
        () => admin.storage.from(BUCKET).remove([objectPath!]),
      )] : []),
      ...(conversationId ? [cleanupAttempt(
        "CONVERSATION_DELETE_FAILED",
        () => admin.from("messenger_conversations").delete().eq("id", conversationId!),
      )] : []),
      ...[...createdUserIds].reverse().map((userId) => cleanupAttempt(
        "EPHEMERAL_AUTH_USER_DELETE_FAILED",
        () => admin.auth.admin.deleteUser(userId),
      )),
    ]);

    async function countRows(
      operation: () => PromiseLike<{ count: number | null; error: unknown | null }>,
    ): Promise<{ count: number; failed: boolean }> {
      try {
        const result = await operation();
        return { count: result.count ?? 0, failed: !!result.error };
      } catch {
        return { count: 0, failed: true };
      }
    }

    const conversationFilterId = conversationId ?? "00000000-0000-0000-0000-000000000000";
    const [remainingConversation, remainingMessages, remainingParticipants] = await Promise.all([
      countRows(() => admin.from("messenger_conversations")
        .select("id", { count: "exact", head: true }).eq("id", conversationFilterId)),
      countRows(() => admin.from("messenger_messages")
        .select("id", { count: "exact", head: true }).eq("conversation_id", conversationFilterId)),
      countRows(() => admin.from("messenger_participants")
        .select("user_id", { count: "exact", head: true }).eq("conversation_id", conversationFilterId)),
    ]);
    const remainingAttachments = objectPath
      ? await countRows(() => admin.from("messenger_attachments")
        .select("id", { count: "exact", head: true }).eq("object_path", objectPath!))
      : { count: 0, failed: false };

    const objectPaths = [
      ...profileAvatarPaths.map((path) => ({ bucket: "profile-avatars", path })),
      ...(objectPath ? [{ bucket: BUCKET, path: objectPath }] : []),
    ];
    const storageAbsenceChecks = await Promise.all(objectPaths.map(async ({ bucket, path }) => {
      try {
        const separator = path.lastIndexOf("/");
        const folder = path.slice(0, separator);
        const filename = path.slice(separator + 1);
        const { data, error } = await admin.storage.from(bucket).list(folder, {
          limit: 100,
          search: filename,
        });
        return {
          failed: !!error,
          count: (data ?? []).filter((item) => item.name === filename).length,
        };
      } catch {
        return { failed: true, count: 0 };
      }
    }));

    const authUserAbsenceChecks = await Promise.all(createdUserIds.map(async (userId) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error) return error.status === 404 || /user not found/i.test(error.message);
        return !data.user;
      } catch {
        return false;
      }
    }));

    const dbChecks = [remainingConversation, remainingMessages, remainingParticipants, remainingAttachments];
    const dbVerificationFailed = dbChecks.some((result) => result.failed);
    const remainingDbRows = dbChecks.reduce((total, result) => total + result.count, 0);
    const storageVerificationFailed = storageAbsenceChecks.some((result) => result.failed);
    const remainingStorageObjects = storageAbsenceChecks.reduce((total, result) => total + result.count, 0);
    const allAuthUsersAbsent = authUserAbsenceChecks.every(Boolean);

    cleanupComplete =
      cleanupErrors.length === 0 &&
      !dbVerificationFailed &&
      remainingDbRows === 0 &&
      !storageVerificationFailed &&
      remainingStorageObjects === 0 &&
      allAuthUsersAbsent;

    const cleanup = checks.find((check) => check.name === "test_data_cleanup");
    if (cleanup) {
      cleanup.status = cleanupComplete ? "PASS" : "FAIL";
      cleanup.detail = cleanupComplete
        ? "Ephemeral A/B/C Auth users, profile avatar objects, Messenger conversation, participants, messages, attachment metadata and attachment object were removed; independent database, Storage and Auth absence checks passed."
        : [
            ...cleanupErrors,
            ...(dbVerificationFailed ? ["DATABASE_ABSENCE_CHECK_FAILED"] : []),
            ...(remainingDbRows > 0 ? ["MESSENGER_DATABASE_ROWS_REMAIN"] : []),
            ...(storageVerificationFailed ? ["STORAGE_ABSENCE_CHECK_FAILED"] : []),
            ...(remainingStorageObjects > 0 ? ["STORAGE_OBJECTS_REMAIN"] : []),
            ...(!allAuthUsersAbsent ? ["AUTH_USERS_REMAIN_OR_ABSENCE_UNVERIFIED"] : []),
          ].join(", ") || "Temporary QA resources remain or could not be verified as removed.";
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
