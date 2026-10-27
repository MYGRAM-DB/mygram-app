
/**
 * MYGRAM: live Supabase RLS isolation test.
 *
 * Run only against a dedicated PRIVATE test chat:
 *   - A and B are members
 *   - C is not a member
 *
 * Uses only normal user access tokens and the anon/publishable key.
 * Never uses the service-role key.
 *
 * Required environment variables:
 * SUPABASE_URL
 * SUPABASE_ANON_KEY
 * MYGRAM_TEST_USER_A_EMAIL
 * MYGRAM_TEST_USER_A_PASSWORD
 * MYGRAM_TEST_USER_B_EMAIL
 * MYGRAM_TEST_USER_B_PASSWORD
 * MYGRAM_TEST_USER_C_EMAIL
 * MYGRAM_TEST_USER_C_PASSWORD
 * MYGRAM_TEST_CHAT_ID
 */

const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "MYGRAM_TEST_USER_A_EMAIL",
  "MYGRAM_TEST_USER_A_PASSWORD",
  "MYGRAM_TEST_USER_B_EMAIL",
  "MYGRAM_TEST_USER_B_PASSWORD",
  "MYGRAM_TEST_USER_C_EMAIL",
  "MYGRAM_TEST_USER_C_PASSWORD",
  "MYGRAM_TEST_CHAT_ID",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(2);
}

const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY;
const chatId = process.env.MYGRAM_TEST_CHAT_ID;

// Unique marker means cleanup only targets this test's message.
const marker =
  `MYGRAM_LIVE_RLS_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

let userA;
let userB;
let userC;
let insertedMessageId;
let forgedMessageId;
let failed = false;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
  pass(message);
}

async function api(path, options = {}) {
  const {
    token,
    method = "GET",
    body,
    prefer,
  } = options;

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function signIn(letter) {
  const email = process.env[`MYGRAM_TEST_USER_${letter}_EMAIL`];
  const password = process.env[`MYGRAM_TEST_USER_${letter}_PASSWORD`];

  const result = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });

  if (
    !result.ok ||
    !result.data?.access_token ||
    !result.data?.user?.id
  ) {
    throw new Error(
      `Sign-in for test user ${letter} failed (HTTP ${result.status}). ` +
      "Check credentials and whether email confirmation is required."
    );
  }

  return {
    token: result.data.access_token,
    id: result.data.user.id,
  };
}

function restFilter(value) {
  return encodeURIComponent(value);
}

async function getMembership(user) {
  return api(
    `/rest/v1/chat_members?select=user_id` +
      `&chat_id=eq.${restFilter(chatId)}` +
      `&user_id=eq.${restFilter(user.id)}`,
    { token: user.token }
  );
}

async function getTestMessage(user, body = marker) {
  return api(
    `/rest/v1/chat_messages?select=id,chat_id,sender_id,body` +
      `&chat_id=eq.${restFilter(chatId)}` +
      `&body=eq.${restFilter(body)}`,
    { token: user.token }
  );
}

async function deleteTestMessage(user, body) {
  return api(
    `/rest/v1/chat_messages` +
      `?chat_id=eq.${restFilter(chatId)}` +
      `&body=eq.${restFilter(body)}`,
    {
      token: user.token,
      method: "DELETE",
      prefer: "return=minimal",
    }
  );
}

async function run() {
  [userA, userB, userC] = await Promise.all([
    signIn("A"),
    signIn("B"),
    signIn("C"),
  ]);

  assert(
    new Set([userA.id, userB.id, userC.id]).size === 3,
    "A, B and C are three distinct authenticated users"
  );

  // Check that this is a direct/private chat visible to A.
  const chatResult = await api(
    `/rest/v1/chats?select=id,is_group` +
      `&id=eq.${restFilter(chatId)}`,
    { token: userA.token }
  );

  assert(
    chatResult.ok &&
      Array.isArray(chatResult.data) &&
      chatResult.data.length === 1 &&
      chatResult.data[0].is_group === false,
    "Configured test chat exists and is_group=false"
  );

  const [memberA, memberB, memberC] = await Promise.all([
    getMembership(userA),
    getMembership(userB),
    getMembership(userC),
  ]);

  assert(
    memberA.ok &&
      Array.isArray(memberA.data) &&
      memberA.data.some((row) => row.user_id === userA.id),
    "A can verify their membership in the test chat"
  );

  assert(
    memberB.ok &&
      Array.isArray(memberB.data) &&
      memberB.data.some((row) => row.user_id === userB.id),
    "B can verify their membership in the test chat"
  );

  // RLS can hide membership rows from C. An empty result is expected;
  // the test fixture must also be configured so C is not a member.
  assert(
    memberC.ok &&
      Array.isArray(memberC.data) &&
      !memberC.data.some((row) => row.user_id === userC.id),
    "C's session cannot see a membership row for C in this chat"
  );

  const inserted = await api("/rest/v1/chat_messages", {
    token: userA.token,
    method: "POST",
    prefer: "return=representation",
    body: {
      chat_id: chatId,
      sender_id: userA.id,
      body: marker,
    },
  });

  assert(
    inserted.ok &&
      Array.isArray(inserted.data) &&
      inserted.data.length === 1 &&
      inserted.data[0].sender_id === userA.id,
    `A can send a test message (HTTP ${inserted.status})`
  );

  insertedMessageId = inserted.data[0].id;

  const [readA, readB, readC] = await Promise.all([
    getTestMessage(userA),
    getTestMessage(userB),
    getTestMessage(userC),
  ]);

  assert(
    readA.ok &&
      Array.isArray(readA.data) &&
      readA.data.some((row) => row.id === insertedMessageId),
    "A can read the message they sent"
  );

  assert(
    readB.ok &&
      Array.isArray(readB.data) &&
      readB.data.some((row) => row.id === insertedMessageId),
    "B can read A's message as a member"
  );

  assert(
    readC.ok &&
      Array.isArray(readC.data) &&
      !readC.data.some((row) => row.id === insertedMessageId),
    "C cannot read A's private message"
  );

  // Attempt to impersonate A from C's authenticated session.
  const forgedBody = `${marker}_FORGED`;
  const forged = await api("/rest/v1/chat_messages", {
    token: userC.token,
    method: "POST",
    prefer: "return=representation",
    body: {
      chat_id: chatId,
      sender_id: userA.id,
      body: forgedBody,
    },
  });

  if (forged.ok && Array.isArray(forged.data) && forged.data.length > 0) {
    forgedMessageId = forged.data[0].id;
  }

  assert(
    !forged.ok,
    `C's forged-sender insert is rejected (HTTP ${forged.status})`
  );

  console.log("LIVE RLS RESULT: PASS");
}

try {
  await run();
} catch (error) {
  failed = true;
  console.error(`LIVE RLS RESULT: FAIL: ${error.message}`);
} finally {
  // Clean up only messages created with this run's unique marker.
  // If the unexpected forged insert succeeded, A owns its sender_id
  // and may be able to delete it under the current sender-delete policy.
  if (userA?.token) {
    const cleanup = await deleteTestMessage(userA, marker);

    if (!cleanup.ok) {
      failed = true;
      console.error(
        `CLEANUP WARNING: could not delete test message (HTTP ${cleanup.status}).`
      );
    } else {
      console.log("Cleanup: original test message deletion requested.");
    }

    if (forgedMessageId) {
      const forgedCleanup = await deleteTestMessage(
        userA,
        `${marker}_FORGED`
      );

      if (!forgedCleanup.ok) {
        failed = true;
        console.error(
          `CLEANUP WARNING: forged test row may remain (HTTP ${forgedCleanup.status}).`
        );
      }
    }
  }
}

if (failed) {
  process.exit(1);
}
