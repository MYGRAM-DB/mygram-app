# Staging Auth / RLS / Storage / Messenger Integration Tests

All integration tests are Staging-only. Never place passwords, secret keys, or service-role keys in source files or chat.

## Existing two-user suite

File: tests/authz.integration.mjs

Required repository variable:
- MYGRAM_STAGING_URL

Required repository Actions secrets:
- MYGRAM_STAGING_PUBLISHABLE_KEY
- MYGRAM_TEST_USER_A_EMAIL
- MYGRAM_TEST_USER_A_PASSWORD
- MYGRAM_TEST_USER_B_EMAIL
- MYGRAM_TEST_USER_B_PASSWORD

Enable by setting repository variable:
- MYGRAM_STAGING_AUTHZ_TESTS=true

The suite signs in two independent confirmed accounts, checks distinct JWT identities, completes each profile, tests private profile details and verification-field protection, and exercises private profile avatar Storage upload/read/upsert and cross-user denials. It cleans temporary avatar objects through the Storage API.

## Three-user Messenger suite

File: tests/messenger-three-party.integration.mjs

Required repository variable:
- MYGRAM_STAGING_URL=https://cbyvtehvaojxfcgpelir.supabase.co

Required repository Actions secrets:
- MYGRAM_STAGING_PUBLISHABLE_KEY
- MYGRAM_MESSENGER_USER_A_EMAIL
- MYGRAM_MESSENGER_USER_A_PASSWORD
- MYGRAM_MESSENGER_USER_B_EMAIL
- MYGRAM_MESSENGER_USER_B_PASSWORD
- MYGRAM_MESSENGER_USER_C_EMAIL
- MYGRAM_MESSENGER_USER_C_PASSWORD

Enable by setting repository variable:
- MYGRAM_MESSENGER_ABC_TESTS=true

The test is hard-locked to the MYGRAM-STAGING project ref and uses only the Staging Publishable Key plus three separate confirmed QA accounts. It does not use service_role or secret API keys.

### What it verifies

1. A, B, and C authenticate through Supabase Auth and resolve to three different user IDs.
2. A creates or reuses a direct conversation with B; the participant trigger creates exactly the two members.
3. A and B each send a message and both can read the conversation, membership, and message history.
4. A uploads a private file to the conversation; B can download it and read its metadata.
5. C sees zero rows for the conversation, participants, messages, and attachment metadata, even when querying by the known conversation ID.
6. C cannot download the private attachment.
7. C cannot spoof A's sender ID, add itself to the membership table, or create a conversation whose members are A and B.
8. A and B can join the private Realtime topic. C must fail to subscribe.

### QA fixture behavior

The three accounts must be dedicated Staging QA accounts. The suite creates or reuses one direct A/B conversation, uses fixed client message IDs, and uploads a stable fixture object path. It intentionally keeps this stable fixture in Staging so repeated CI runs do not create additional conversations, messages, or attachment objects. Do not use personal/Production accounts.

## SQL rollback probe

The Staging database was also tested using SET LOCAL ROLE authenticated with separate simulated JWT claims, all inside one transaction followed by ROLLBACK. This verified membership RLS and denial rules without leaving data. It is not a replacement for the three real JWT sessions or a real Realtime WebSocket test.

## Not covered

- SMTP delivery, confirmation email receipt, and password-reset email delivery. These require a mailbox-backed test.
- SMS/phone OTP delivery.
- Group conversation policy, message edits/deletes, read receipts, typing presence, voice/video calls, and client UI cross-device verification.
- Production deployment or production data.

## Local execution

    npm run test:integration
    npm run test:messenger:integration

Run only against Staging and only with the dedicated QA accounts. Never point these variables at Production.
