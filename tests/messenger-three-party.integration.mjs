import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.MYGRAM_STAGING_URL?.replace(/\/$/, "");
const apiKey = process.env.MYGRAM_STAGING_PUBLISHABLE_KEY;
const stagingRef = "cbyvtehvaojxfcgpelir";

const accounts = [
  { label: "A", email: process.env.MYGRAM_MESSENGER_USER_A_EMAIL, password: process.env.MYGRAM_MESSENGER_USER_A_PASSWORD },
  { label: "B", email: process.env.MYGRAM_MESSENGER_USER_B_EMAIL, password: process.env.MYGRAM_MESSENGER_USER_B_PASSWORD },
  { label: "C", email: process.env.MYGRAM_MESSENGER_USER_C_EMAIL, password: process.env.MYGRAM_MESSENGER_USER_C_PASSWORD },
];

for (const [name, value] of Object.entries({
  MYGRAM_STAGING_URL: baseUrl,
  MYGRAM_STAGING_PUBLISHABLE_KEY: apiKey,
  MYGRAM_MESSENGER_USER_A_EMAIL: accounts[0].email,
  MYGRAM_MESSENGER_USER_A_PASSWORD: accounts[0].password,
  MYGRAM_MESSENGER_USER_B_EMAIL: accounts[1].email,
  MYGRAM_MESSENGER_USER_B_PASSWORD: accounts[1].password,
  MYGRAM_MESSENGER_USER_C_EMAIL: accounts[2].email,
  MYGRAM_MESSENGER_USER_C_PASSWORD: accounts[2].password,
})) {
  assert.ok(value, `Missing required integration-test environment variable: ${name}`);
}

assert.ok(apiKey.startsWith("sb_publishable_"), "Use only a Staging publishable key; never use service_role.");
const parsedUrl = new URL(baseUrl);
assert.equal(parsedUrl.hostname, `${stagingRef}.supabase.co`, "This test is locked to MYGRAM-STAGING.");
assert.equal(new Set(accounts.map((account) => account.email.toLowerCase())).size, 3, "A, B, and C must be three distinct accounts.");

async function signIn(account) {
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `Password sign-in failed for account ${account.label}: ${JSON.stringify(body)}`);
  assert.ok(body.access_token, `No access JWT returned for account ${account.label}`);
  return { ...account, token: body.access_token, user: body.user };
}

const [a, b, c] = await Promise.all(accounts.map(signIn));
assert.equal(new Set([a.user.id, b.user.id, c.user.id]).size, 3, "A, B, and C must resolve to three different Auth identities.");
console.log("PASS: A, B, and C authenticated through Supabase Auth and received three distinct JWT identities.");

async function api(session, path, options = {}) {
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${session.token}`,
    ...(options.body && !(options.body instanceof Uint8Array) ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const raw = await response.text();
  let body = raw;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* keep Storage error bodies as text */ }
  return { response, body };
}

async function expectRows(session, path, expected, message) {
  const result = await api(session, path);
  assert.equal(result.response.status, 200, `${message}: HTTP ${result.response.status} ${JSON.stringify(result.body)}`);
  assert.equal(result.body?.length, expected, `${message}: expected ${expected} rows, received ${result.body?.length}`);
  return result.body;
}

const [userLow, userHigh] = [a.user.id, b.user.id].sort();
const pairQuery = new URLSearchParams({
  select: "id,user_low,user_high",
  user_low: `eq.${userLow}`,
  user_high: `eq.${userHigh}`,
  limit: "1",
});

const pairLookup = await api(a, `/rest/v1/messenger_conversations?${pairQuery}`);
assert.equal(pairLookup.response.status, 200, `Direct conversation lookup failed: ${JSON.stringify(pairLookup.body)}`);
const pairRows = pairLookup.body ?? [];
assert.ok(pairRows.length <= 1, "More than one direct conversation exists for the same canonical pair.");
let conversationId;

if (pairRows.length === 0) {
  const created = await api(a, "/rest/v1/messenger_conversations?select=id,user_low,user_high", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_low: userLow, user_high: userHigh, created_by: a.user.id }),
  });
  assert.equal(created.response.status, 201, `A could not create the A/B conversation: ${JSON.stringify(created.body)}`);
  conversationId = created.body?.[0]?.id;
} else {
  conversationId = pairRows[0].id;
}
assert.ok(conversationId, "The A/B conversation must have an id.");
console.log("PASS: A can create or reuse a direct conversation with B.");

const fixedMessageIdA = "33333333-3333-4333-8333-333333333333";
const fixedMessageIdB = "44444444-4444-4444-8444-444444444444";
const messageBodyA = "MYGRAM Messenger three-party isolation fixture: A to B.";
const messageBodyB = "MYGRAM Messenger three-party isolation fixture: B to A.";

async function ensureMessage(session, senderId, clientMessageId, body) {
  const query = new URLSearchParams({
    select: "id,conversation_id,sender_id,client_message_id",
    conversation_id: `eq.${conversationId}`,
    sender_id: `eq.${senderId}`,
    client_message_id: `eq.${clientMessageId}`,
    limit: "1",
  });
  const lookup = await api(session, `/rest/v1/messenger_messages?${query}`);
  assert.equal(lookup.response.status, 200, `Fixture message lookup failed: ${JSON.stringify(lookup.body)}`);
  const existing = lookup.body ?? [];
  assert.ok(existing.length <= 1, "Duplicate client_message_id fixture rows were found.");
  if (existing.length) return existing[0].id;

  const inserted = await api(session, "/rest/v1/messenger_messages?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: senderId,
      client_message_id: clientMessageId,
      message_type: "text",
      body,
    }),
  });
  assert.equal(inserted.response.status, 201, `Participant ${session.label} could not send a message: ${JSON.stringify(inserted.body)}`);
  return inserted.body?.[0]?.id;
}

const messageAId = await ensureMessage(a, a.user.id, fixedMessageIdA, messageBodyA);
const messageBId = await ensureMessage(b, b.user.id, fixedMessageIdB, messageBodyB);
assert.ok(messageAId && messageBId, "Both participants must send messages.");
console.log("PASS: A and B can each send a message to their shared conversation.");

const objectPath = `${conversationId}/${a.user.id}/messenger-abc-fixture.png`;
const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
  "base64",
));
const upload = await api(a, `/storage/v1/object/messenger-attachments/${objectPath}`, {
  method: "POST",
  body: png,
  headers: { "Content-Type": "image/png", "x-upsert": "true" },
});
assert.ok(upload.response.ok, `A could not upload the Messenger test attachment: HTTP ${upload.response.status} ${JSON.stringify(upload.body)}`);

const attachmentQuery = new URLSearchParams({
  select: "id,conversation_id,message_id,uploaded_by,object_path",
  object_path: `eq.${objectPath}`,
  limit: "1",
});
const attachmentLookup = await api(a, `/rest/v1/messenger_attachments?${attachmentQuery}`);
assert.equal(attachmentLookup.response.status, 200, `Attachment metadata lookup failed: ${JSON.stringify(attachmentLookup.body)}`);
const existingAttachment = attachmentLookup.body ?? [];
assert.ok(existingAttachment.length <= 1, "Duplicate attachment fixture metadata was found.");
if (existingAttachment.length === 0) {
  const attachmentInsert = await api(a, "/rest/v1/messenger_attachments", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      message_id: messageAId,
      uploaded_by: a.user.id,
      object_path: objectPath,
      mime_type: "image/png",
      byte_size: png.byteLength,
    }),
  });
  assert.equal(attachmentInsert.response.status, 201, `Attachment metadata insert failed: ${JSON.stringify(attachmentInsert.body)}`);
}
console.log("PASS: A uploaded a private attachment and linked its metadata to the A/B conversation.");

const conversationFilter = new URLSearchParams({ select: "id", id: `eq.${conversationId}` });
const messageFilter = new URLSearchParams({ select: "id,sender_id", conversation_id: `eq.${conversationId}` });
const participantFilter = new URLSearchParams({ select: "user_id", conversation_id: `eq.${conversationId}` });
const attachmentFilter = new URLSearchParams({ select: "id,object_path", conversation_id: `eq.${conversationId}` });

await expectRows(b, `/rest/v1/messenger_conversations?${conversationFilter}`, 1, "B conversation read");
await expectRows(b, `/rest/v1/messenger_participants?${participantFilter}`, 2, "B participant list");
await expectRows(b, `/rest/v1/messenger_messages?${messageFilter}`, 2, "B message history");
await expectRows(b, `/rest/v1/messenger_attachments?${attachmentFilter}`, 1, "B attachment metadata read");

await expectRows(c, `/rest/v1/messenger_conversations?${conversationFilter}`, 0, "C direct conversation read denial");
await expectRows(c, `/rest/v1/messenger_participants?${participantFilter}`, 0, "C participant list denial");
await expectRows(c, `/rest/v1/messenger_messages?${messageFilter}`, 0, "C message history denial");
await expectRows(c, `/rest/v1/messenger_attachments?${attachmentFilter}`, 0, "C attachment metadata denial");
console.log("PASS: B can read the shared conversation; C sees zero conversations, participants, messages, and attachments.");

const bDownload = await api(b, `/storage/v1/object/authenticated/messenger-attachments/${objectPath}`);
assert.equal(bDownload.response.status, 200, "B must download the private attachment.");
const cDownload = await api(c, `/storage/v1/object/authenticated/messenger-attachments/${objectPath}`);
assert.ok([400, 401, 403, 404].includes(cDownload.response.status), `C downloaded the private attachment: HTTP ${cDownload.response.status}`);

const spoof = await api(c, "/rest/v1/messenger_messages", {
  method: "POST",
  body: JSON.stringify({
    conversation_id: conversationId,
    sender_id: a.user.id,
    client_message_id: "55555555-5555-4555-8555-555555555555",
    message_type: "text",
    body: "C must not spoof A.",
  }),
});
assert.ok([401, 403].includes(spoof.response.status), `C spoofed A's sender id: HTTP ${spoof.response.status}`);

const selfAdd = await api(c, "/rest/v1/messenger_participants", {
  method: "POST",
  body: JSON.stringify({ conversation_id: conversationId, user_id: c.user.id, role: "member" }),
});
assert.ok([401, 403].includes(selfAdd.response.status), `C added itself to A/B membership: HTTP ${selfAdd.response.status}`);

const fakeConversation = await api(c, "/rest/v1/messenger_conversations", {
  method: "POST",
  body: JSON.stringify({ user_low: userLow, user_high: userHigh, created_by: c.user.id }),
});
assert.ok([401, 403].includes(fakeConversation.response.status), `C created a conversation without being one of its members: HTTP ${fakeConversation.response.status}`);
console.log("PASS: C cannot download the attachment, spoof A as sender, add itself as a participant, or create an A/B conversation.");

async function realtimeJoin(session) {
  const client = createClient(baseUrl, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  await client.realtime.setAuth(session.token);
  const channel = client.channel(`messenger:${conversationId}:messages`, { config: { private: true } });
  const status = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve("TIMEOUT"), 12000);
    channel.subscribe((value) => {
      if (value === "SUBSCRIBED" || value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") {
        clearTimeout(timer);
        resolve(value);
      }
    });
  });
  await client.removeChannel(channel).catch(() => undefined);
  await client.auth.signOut().catch(() => undefined);
  return status;
}

const [realtimeA, realtimeB, realtimeC] = await Promise.all([
  realtimeJoin(a), realtimeJoin(b), realtimeJoin(c),
]);
assert.equal(realtimeA, "SUBSCRIBED", `A could not join the private Realtime channel: ${realtimeA}`);
assert.equal(realtimeB, "SUBSCRIBED", `B could not join the private Realtime channel: ${realtimeB}`);
assert.notEqual(realtimeC, "SUBSCRIBED", "C joined the private A/B Realtime channel.");
console.log("PASS: A and B joined the private Realtime topic; C was denied.");

console.log("PASS: three-party Messenger authorization integration completed against MYGRAM-STAGING.");
console.log("NOTE: The A/B conversation and two fixed QA messages are a stable fixture reserved for these three QA accounts. The uploaded test object is also a stable fixture and is overwritten on rerun.");
