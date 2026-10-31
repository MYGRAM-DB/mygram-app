import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { extractBearerToken, isTrustedStagingWorkflowClaims } from "../_shared/github-oidc-policy.mjs";

const PROJECT_REF = "cbyvtehvaojxfcgpelir";
const AVATAR_BUCKET = "profile-avatars";
const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const OIDC_AUDIENCE = "mygram-staging-qa";
const OIDC_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authorizeGitHubWorkflow(request: Request): Promise<Record<string, unknown> | null> {
  const oidcToken = extractBearerToken(request.headers.get("authorization") ?? "");
  if (!oidcToken) return null;

  try {
    const verified = await jwtVerify(oidcToken, OIDC_JWKS, {
      issuer: OIDC_ISSUER,
      audience: OIDC_AUDIENCE,
      algorithms: ["RS256"],
    });
    const claims = verified.payload as Record<string, unknown>;
    return isTrustedStagingWorkflowClaims(claims) ? claims : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const claims = await authorizeGitHubWorkflow(request);
  if (!claims) return json({ ok: false, error: "GITHUB_WORKFLOW_IDENTITY_NOT_ALLOWLISTED" }, 403);

  const apiUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (new URL(apiUrl).hostname !== `${PROJECT_REF}.supabase.co`) {
    return json({ ok: false, error: "WRONG_SUPABASE_PROJECT" }, 500);
  }

  const secretDictionary = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const secretKey = secretDictionary.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicDictionary = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const publicKey = publicDictionary.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!secretKey || !publicKey) return json({ ok: false, error: "SUPABASE_SERVER_KEYS_UNAVAILABLE" }, 500);

  const admin = createClient(apiUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const oidcToken = extractBearerToken(request.headers.get("authorization") ?? "");
  assert(oidcToken, "GITHUB_OIDC_TOKEN_REQUIRED");
  const tokenHash = await sha256(oidcToken);
  const now = new Date().toISOString();
  const expiry = new Date(Number(claims.exp) * 1000).toISOString();
  await admin.from("qa_run_challenges").delete().lt("expires_at", now);
  const { error: replayError } = await admin.from("qa_run_challenges").insert({
    token_hash: tokenHash,
    expires_at: expiry,
    consumed_at: now,
  });
  if (replayError) return json({ ok: false, error: "GITHUB_OIDC_TOKEN_REPLAYED_OR_REJECTED" }, 409);

  const runId = crypto.randomUUID();
  const prefix = `qa-${runId.replaceAll("-", "")}`;
  const accounts = [
    { label: "A", email: `${prefix}-a@example.com`, password: `${crypto.randomUUID()}Aa9!` },
    { label: "B", email: `${prefix}-b@example.com`, password: `${crypto.randomUUID()}Bb8!` },
    { label: "C", email: `${prefix}-c@example.com`, password: `${crypto.randomUUID()}Cc7!` },
  ];
  const createdUserIds: string[] = [];
  const sessions = new Map<string, { client: SupabaseClient; userId: string; accessToken: string; refreshToken: string }>();
  const createdPrivateIds: string[] = [];
  const avatarPaths: string[] = [];
  const checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> = [];
  let cleanupComplete = false;

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

    for (const account of accounts) {
      const client = createClient(apiUrl, publicKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      assert(!error && data.session && data.user, `REAL_JWT_SIGN_IN_FAILED_${account.label}`);
      sessions.set(account.label, {
        client,
        userId: data.user.id,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
    }

    const a = sessions.get("A")!;
    const b = sessions.get("B")!;
    const c = sessions.get("C")!;
    assert(new Set([a.userId, b.userId, c.userId]).size === 3, "THREE_AUTH_USERS_NOT_DISTINCT");
    const sessionCheck = await a.client.auth.getUser(a.accessToken);
    assert(!sessionCheck.error && sessionCheck.data.user?.id === a.userId, "A_SESSION_DID_NOT_CONTINUE");
    checks.push({ name: "three_independent_real_jwt_sessions", status: "PASS", detail: "A, B and C authenticated through Supabase Auth password grant and received distinct JWT identities; A's live session resolves to its own user." });

    async function ensurePrivateRow(session: { userId: string }, label: string) {
      // Fixture setup is server-admin only. Every authorization assertion below
      // continues to use the independent A/B/C user-scoped JWT clients.
      const { data, error } = await admin.from("profile_private_details").insert({
        user_id: session.userId,
        date_of_birth: "1990-01-01",
        gender: "prefer_not_to_say",
        nationality_code: "US",
      }).select("user_id").single();
      assert(!error && data?.user_id === session.userId, `ADMIN_PRIVATE_PROFILE_FIXTURE_FAILED_${label}`);
      createdPrivateIds.push(session.userId);
    }

    await Promise.all([ensurePrivateRow(a, "A"), ensurePrivateRow(b, "B"), ensurePrivateRow(c, "C")]);

    const { data: ownA, error: ownAError } = await a.client.from("profile_private_details")
      .select("user_id,date_of_birth,gender,nationality_code")
      .eq("user_id", a.userId);
    assert(!ownAError && ownA?.length === 1, "A_CANNOT_READ_OWN_PRIVATE_DETAILS");

    const { data: crossPrivate, error: crossPrivateError } = await a.client.from("profile_private_details")
      .select("user_id")
      .eq("user_id", b.userId);
    assert(!crossPrivateError && crossPrivate?.length === 0, "A_READ_B_PRIVATE_DETAILS");

    const { data: cReadA, error: cReadAError } = await c.client.from("profile_private_details")
      .select("user_id").eq("user_id", a.userId);
    const { data: cReadB, error: cReadBError } = await c.client.from("profile_private_details")
      .select("user_id").eq("user_id", b.userId);
    assert(!cReadAError && cReadA?.length === 0 && !cReadBError && cReadB?.length === 0, "C_READ_PRIVATE_DETAILS_OF_A_OR_B");

    const { data: crossUpdate, error: crossUpdateError } = await a.client.from("profile_private_details")
      .update({ contact_phone: "+15555550123" })
      .eq("user_id", b.userId)
      .select("user_id");
    assert(!crossUpdateError && crossUpdate?.length === 0, "A_MODIFIED_B_PRIVATE_DETAILS");

    const { data: cUpdateA, error: cUpdateAError } = await c.client.from("profile_private_details")
      .update({ contact_phone: "+15555550124" }).eq("user_id", a.userId).select("user_id");
    const { data: cUpdateB, error: cUpdateBError } = await c.client.from("profile_private_details")
      .update({ contact_phone: "+15555550125" }).eq("user_id", b.userId).select("user_id");
    assert(!cUpdateAError && cUpdateA?.length === 0 && !cUpdateBError && cUpdateB?.length === 0, "C_MODIFIED_PRIVATE_DETAILS_OF_A_OR_B");

    const { error: verificationError } = await a.client.from("profile_private_details")
      .update({ verified_contact_method: "email", contact_verified_at: new Date().toISOString() })
      .eq("user_id", a.userId);
    assert(verificationError, "CLIENT_WROTE_TRUSTED_VERIFICATION_FIELDS");
    checks.push({ name: "private_profile_rls_and_verified_fields", status: "PASS", detail: "Owner reads own private row; cross-account read/update return zero; browser cannot write verification fields." });

    const { data: publicView, error: publicViewError } = await a.client.from("public_profiles")
      .select("*").eq("id", b.userId).single();
    assert(!publicViewError && publicView?.id === b.userId, "PUBLIC_PROFILE_PROJECTION_NOT_READABLE");
    assert(
      !("study_place" in publicView) &&
      !("work_place" in publicView) &&
      !("profile_completed" in publicView),
      "PUBLIC_PROFILE_VIEW_EXPOSED_PRIVATE_COLUMNS",
    );
    checks.push({ name: "public_profile_projection", status: "PASS", detail: "A can read B's safe public projection; study/work/completion fields are absent." });

    const avatarA = `${a.userId}/qa-${runId}-a.png`;
    const avatarB = `${b.userId}/qa-${runId}-b.png`;
    avatarPaths.push(avatarA, avatarB);

    const { error: uploadAError } = await a.client.storage.from(AVATAR_BUCKET).upload(avatarA, PNG, {
      contentType: "image/png",
      upsert: false,
    });
    assert(!uploadAError, "A_OWN_AVATAR_UPLOAD_FAILED");

    const { error: uploadBError } = await b.client.storage.from(AVATAR_BUCKET).upload(avatarB, PNG, {
      contentType: "image/png",
      upsert: false,
    });
    assert(!uploadBError, "B_OWN_AVATAR_UPLOAD_FAILED");

    const { data: ownerDownload, error: ownerDownloadError } = await a.client.storage.from(AVATAR_BUCKET).download(avatarA);
    assert(!ownerDownloadError && ownerDownload, "A_CANNOT_DOWNLOAD_OWN_AVATAR");

    const { data: crossDownload, error: crossDownloadError } = await b.client.storage.from(AVATAR_BUCKET).download(avatarA);
    assert(crossDownloadError && !crossDownload, "B_DOWNLOADED_A_PRIVATE_AVATAR");

    const { data: cDownload, error: cDownloadError } = await c.client.storage.from(AVATAR_BUCKET).download(avatarA);
    assert(cDownloadError && !cDownload, "C_DOWNLOADED_A_PRIVATE_AVATAR");

    const { error: ownerUpsertError } = await a.client.storage.from(AVATAR_BUCKET).upload(avatarA, PNG, {
      contentType: "image/png",
      upsert: true,
    });
    assert(!ownerUpsertError, "A_OWN_AVATAR_UPSERT_FAILED");

    const { error: crossUpsertError } = await b.client.storage.from(AVATAR_BUCKET).upload(avatarA, PNG, {
      contentType: "image/png",
      upsert: true,
    });
    assert(crossUpsertError, "B_OVERWROTE_A_PRIVATE_AVATAR");

    const { error: crossDeleteError } = await b.client.storage.from(AVATAR_BUCKET).remove([avatarA]);
    const { data: ownerStillHasAvatar, error: ownerAfterDeleteError } = await a.client.storage.from(AVATAR_BUCKET).download(avatarA);
    assert(!ownerAfterDeleteError && ownerStillHasAvatar, "B_DELETED_OR_DAMAGED_A_PRIVATE_AVATAR");
    checks.push({ name: "private_avatar_storage_isolation", status: "PASS", detail: "A/B upload their own avatars; A reads and upserts; B cannot read, overwrite, or delete A's object." });

    const profileUpdate = await a.client.from("profiles")
      .update({ first_name: "QA-CROSS-ACCOUNT-BLOCKED" })
      .eq("id", b.userId)
      .select("id");
    assert(
      !!profileUpdate.error || (profileUpdate.data?.length ?? 0) === 0,
      "A_UPDATED_B_BASE_PROFILE",
    );
    checks.push({ name: "base_profile_cross_account_write_denied", status: "PASS", detail: "A cannot update B's base profile row." });

    const cProfileUpdate = await c.client.from("profiles")
      .update({ first_name: "QA-CROSS-ACCOUNT-C-BLOCKED" }).eq("id", a.userId).select("id");
    assert(!!cProfileUpdate.error || (cProfileUpdate.data?.length ?? 0) === 0, "C_UPDATED_A_BASE_PROFILE");

    const { error: revokeError } = await admin.auth.admin.signOut(c.accessToken);
    assert(!revokeError, "C_SESSION_REVOCATION_FAILED");
    const refreshResponse = await fetch(`${apiUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: publicKey, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: c.refreshToken }),
    });
    assert(!refreshResponse.ok, "C_REFRESH_TOKEN_WORKED_AFTER_GLOBAL_REVOCATION");
    checks.push({ name: "revoked_refresh_token_rejected", status: "PASS", detail: "C's server-side session was revoked; its original refresh token could not obtain a new session. Access JWT revocation is not claimed before its exp time." });
  } catch (error) {
    checks.push({
      name: "auth_rls_storage_suite",
      status: "FAIL",
      detail: error instanceof Error ? error.message : "UNKNOWN_AUTHZ_SUITE_ERROR",
    });
  } finally {
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

    // Isolate cleanup per object/row/user so one transient failure does not
    // prevent the remaining ephemeral QA resources from being removed.
    await Promise.all([
      ...avatarPaths.map((path) => cleanupAttempt(
        "AVATAR_STORAGE_CLEANUP_FAILED",
        () => admin.storage.from(AVATAR_BUCKET).remove([path]),
      )),
      ...createdPrivateIds.map((userId) => cleanupAttempt(
        "PRIVATE_PROFILE_FIXTURE_CLEANUP_FAILED",
        () => admin.from("profile_private_details").delete().eq("user_id", userId),
      )),
      ...[...createdUserIds].reverse().map((userId) => cleanupAttempt(
        "EPHEMERAL_AUTH_USER_DELETE_FAILED",
        () => admin.auth.admin.deleteUser(userId),
      )),
    ]);

    let remainingPrivateCount = 0;
    let privateVerificationFailed = false;
    if (createdPrivateIds.length > 0) {
      try {
        const { count, error } = await admin.from("profile_private_details")
          .select("user_id", { count: "exact", head: true })
          .in("user_id", createdPrivateIds);
        remainingPrivateCount = count ?? 0;
        privateVerificationFailed = !!error;
      } catch {
        privateVerificationFailed = true;
      }
    }

    const remainingObjectChecks = await Promise.all(avatarPaths.map(async (path) => {
      try {
        const separator = path.lastIndexOf("/");
        const folder = path.slice(0, separator);
        const filename = path.slice(separator + 1);
        const { data, error } = await admin.storage.from(AVATAR_BUCKET).list(folder, {
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
    const remainingObjectErrors = remainingObjectChecks.filter((result) => result.failed);
    const remainingObjectCount = remainingObjectChecks.reduce((total, result) => total + result.count, 0);

    // Verify Auth-user absence independently after deletion, not merely that
    // deleteUser returned without an error.
    const authUserAbsenceChecks = await Promise.all(createdUserIds.map(async (userId) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error) {
          return error.status === 404 || /user not found/i.test(error.message);
        }
        return !data.user;
      } catch {
        return false;
      }
    }));
    const allAuthUsersAbsent = authUserAbsenceChecks.every(Boolean);

    cleanupComplete =
      cleanupErrors.length === 0 &&
      !privateVerificationFailed && remainingPrivateCount === 0 &&
      remainingObjectErrors.length === 0 && remainingObjectCount === 0 &&
      allAuthUsersAbsent;

    const cleanupFailureDetails = [
      ...new Set(cleanupErrors),
      ...(privateVerificationFailed ? ["PRIVATE_PROFILE_ABSENCE_CHECK_FAILED"] : []),
      ...(remainingPrivateCount > 0 ? ["PRIVATE_PROFILE_FIXTURE_REMAINS"] : []),
      ...(remainingObjectErrors.length > 0 ? ["AVATAR_OBJECT_ABSENCE_CHECK_FAILED"] : []),
      ...(remainingObjectCount > 0 ? ["AVATAR_OBJECT_REMAINS"] : []),
      ...(!allAuthUsersAbsent ? ["AUTH_USER_ABSENCE_CHECK_FAILED_OR_USER_REMAINS"] : []),
    ];

    checks.push({
      name: "qa_data_cleanup",
      status: cleanupComplete ? "PASS" : "FAIL",
      detail: cleanupComplete
        ? "Ephemeral Auth users, private profile fixtures, and avatar objects were deleted; independent absence checks passed for every resource."
        : cleanupFailureDetails.join(", ") || "Temporary QA data remains or could not be verified as removed.",
    });
  }

  const passed = checks.filter((check) => check.status === "PASS").length;
  const failed = checks.filter((check) => check.status === "FAIL").length;
  const ok = failed === 0 && cleanupComplete;
  return json({
    ok,
    project: PROJECT_REF,
    suite: "MYGRAM Auth JWT + Profiles RLS + Storage isolation",
    total_checks: checks.length,
    passed,
    failed,
    cleanup_complete: cleanupComplete,
    checks,
  }, ok ? 200 : 500);
});
