import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.MYGRAM_STAGING_URL?.replace(/\/$/, "");
const apiKey = process.env.MYGRAM_STAGING_PUBLISHABLE_KEY;
const credentials = [
  { email: process.env.MYGRAM_TEST_USER_A_EMAIL, password: process.env.MYGRAM_TEST_USER_A_PASSWORD, label: "A" },
  { email: process.env.MYGRAM_TEST_USER_B_EMAIL, password: process.env.MYGRAM_TEST_USER_B_PASSWORD, label: "B" },
];

for (const [name, value] of Object.entries({
  MYGRAM_STAGING_URL: baseUrl,
  MYGRAM_STAGING_PUBLISHABLE_KEY: apiKey,
  MYGRAM_TEST_USER_A_EMAIL: credentials[0].email,
  MYGRAM_TEST_USER_A_PASSWORD: credentials[0].password,
  MYGRAM_TEST_USER_B_EMAIL: credentials[1].email,
  MYGRAM_TEST_USER_B_PASSWORD: credentials[1].password,
})) {
  assert.ok(value, `Missing required integration-test environment variable: ${name}`);
}
assert.ok(apiKey.startsWith("sb_publishable_"), "Use the Staging publishable key, never a service-role key.");
assert.notEqual(credentials[0].email.toLowerCase(), credentials[1].email.toLowerCase(), "Test accounts must be independent.");

async function request(path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body && !(options.body instanceof Uint8Array) ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const raw = await response.text();
  let body = raw;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* Keep non-JSON response text for diagnostics. */ }
  return { response, body };
}

async function signIn(account) {
  const { response, body } = await request("/auth/v1/token?grant_type=password", null, {
    method: "POST",
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(response.status, 200, `Sign-in failed for test account ${account.label}: ${JSON.stringify(body)}`);
  assert.ok(body?.access_token, `No access token returned for account ${account.label}`);
  const user = await request("/auth/v1/user", body.access_token);
  assert.equal(user.response.status, 200, `Unable to resolve authenticated user ${account.label}`);
  return { token: body.access_token, user: user.body };
}

async function expectOk(result, message) {
  assert.ok(result.response.ok, `${message}: HTTP ${result.response.status} ${JSON.stringify(result.body)}`);
}

const [a, b] = await Promise.all(credentials.map(signIn));
assert.notEqual(a.user.id, b.user.id, "The two test logins resolved to the same user ID.");
console.log("PASS: two independent Staging password logins returned distinct JWT identities.");

const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const paths = [
  `${a.user.id}/authz-${suffix}.png`,
  `${b.user.id}/authz-${suffix}.png`,
];
const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
  "base64",
));

async function completeProfile(session, label) {
  const { response, body } = await request("/rest/v1/rpc/complete_mygram_profile", session.token, {
    method: "POST",
    body: JSON.stringify({
      p_first_name: "Staging",
      p_last_name: `Test ${label}`,
      p_username: `qa_${label.toLowerCase()}_${suffix}`,
      p_date_of_birth: "1990-01-01",
      p_gender: null,
      p_nationality_code: "US",
      p_contact_phone: null,
      p_current_country_code: "US",
      p_region: null,
      p_city_name: null,
      p_bio: "Automated Staging authorization test account",
      p_interests: ["qa"],
      p_share_location: false,
    }),
  });
  assert.equal(response.status, 200, `Profile RPC failed for account ${label}: ${JSON.stringify(body)}`);
}
await Promise.all([completeProfile(a, "A"), completeProfile(b, "B")]);
console.log("PASS: each JWT completed only its own profile through the auth.uid()-bound RPC.");

const privateSelect = (id) => `/rest/v1/profile_private_details?select=user_id,date_of_birth,gender,nationality_code,contact_email,contact_phone,verified_contact_method,contact_verified_at&user_id=eq.${id}`;
const ownPrivate = await request(privateSelect(a.user.id), a.token);
await expectOk(ownPrivate, "Owner could not read their own private profile details");
assert.equal(ownPrivate.body?.length, 1, "Owner's private profile row is missing.");
const crossPrivate = await request(privateSelect(b.user.id), a.token);
await expectOk(crossPrivate, "Cross-account private read request returned an unexpected API error");
assert.equal(crossPrivate.body?.length, 0, "Account A read Account B's private profile row.");
console.log("PASS: private profile details are visible to the owner and hidden from the other JWT.");

const crossPrivateUpdate = await request(`/rest/v1/profile_private_details?user_id=eq.${b.user.id}`, a.token, {
  method: "PATCH",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({ contact_phone: "+15555550123" }),
});
assert.ok(crossPrivateUpdate.response.ok, `Cross-account update request failed unexpectedly: ${JSON.stringify(crossPrivateUpdate.body)}`);
assert.equal(crossPrivateUpdate.body?.length, 0, "Account A modified Account B's private details.");

const crossProfileUpdate = await request(`/rest/v1/profiles?id=eq.${b.user.id}`, a.token, {
  method: "PATCH",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({ first_name: "Compromised" }),
});
assert.ok(
  [401, 403].includes(crossProfileUpdate.response.status)
    || (crossProfileUpdate.response.ok && crossProfileUpdate.body?.length === 0),
  `Account A modified Account B's profile or the request failed unexpectedly: HTTP ${crossProfileUpdate.response.status} ${JSON.stringify(crossProfileUpdate.body)}`,
);

const verificationTamper = await request(`/rest/v1/profile_private_details?user_id=eq.${a.user.id}`, a.token, {
  method: "PATCH",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({
    verified_contact_method: "email",
    contact_verified_at: new Date().toISOString(),
  }),
});
assert.ok(
  [401, 403].includes(verificationTamper.response.status),
  `Verification fields were not rejected by column privileges: HTTP ${verificationTamper.response.status} ${JSON.stringify(verificationTamper.body)}`,
);
console.log("PASS: cross-account private/profile updates are blocked and verification fields cannot be client-written.");

async function storageUpload(session, objectPath, upsert = false) {
  return request(`/storage/v1/object/profile-avatars/${objectPath}`, session.token, {
    method: "POST",
    body: png,
    headers: {
      "Content-Type": "image/png",
      "x-upsert": String(upsert),
    },
  });
}
async function storageDelete(session, objectPath) {
  return request("/storage/v1/object/profile-avatars", session.token, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [objectPath] }),
  });
}

try {
  await expectOk(await storageUpload(a, paths[0]), "Account A upload to its own folder failed");
  await expectOk(await storageUpload(b, paths[1]), "Account B upload to its own folder failed");
  await expectOk(await storageUpload(a, paths[0], true), "Owner upsert to its own avatar failed");

  const ownerRead = await request(`/storage/v1/object/authenticated/profile-avatars/${paths[0]}`, a.token);
  await expectOk(ownerRead, "Owner could not download their private avatar");

  const crossRead = await request(`/storage/v1/object/authenticated/profile-avatars/${paths[0]}`, b.token);
  assert.ok([400, 401, 403, 404].includes(crossRead.response.status), `Other user read private avatar: HTTP ${crossRead.response.status}`);

  const crossUpload = await storageUpload(b, paths[0], true);
  assert.ok(
    !crossUpload.response.ok,
    `Other user overwrote Account A avatar: HTTP ${crossUpload.response.status}`,
  );

  await storageDelete(b, paths[0]);
  const ownerReadAfterAttack = await request(`/storage/v1/object/authenticated/profile-avatars/${paths[0]}`, a.token);
  await expectOk(ownerReadAfterAttack, "Other user deleted or damaged Account A avatar");
  console.log("PASS: private avatar upload/read/upsert works for owner; cross-account read/overwrite/delete is denied.");
} finally {
  await Promise.all([
    storageDelete(a, paths[0]).catch(() => null),
    storageDelete(b, paths[1]).catch(() => null),
  ]);
}
console.log("PASS: temporary Storage test objects were cleaned up.");
