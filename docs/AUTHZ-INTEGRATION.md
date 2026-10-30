# Staging Auth/RLS/Storage Integration Test

The automated suite in tests/authz.integration.mjs currently covers two dedicated, email-confirmed QA users in MYGRAM-STAGING for identity, private profile data, verification-field protection, and avatar object authorization.

## GitHub Actions configuration

Set repository variables:
- MYGRAM_STAGING_AUTHZ_TESTS=true
- MYGRAM_STAGING_URL=https://<staging-project-ref>.supabase.co

Set repository Actions secrets:
- MYGRAM_STAGING_PUBLISHABLE_KEY
- MYGRAM_TEST_USER_A_EMAIL
- MYGRAM_TEST_USER_A_PASSWORD
- MYGRAM_TEST_USER_B_EMAIL
- MYGRAM_TEST_USER_B_PASSWORD

Never use a service-role or secret key in this test. The two QA users must be separate, confirmed, and reserved for this test. The suite updates their profile fields and creates then deletes temporary private avatar objects. Do not point these variables at Production.

## What it verifies

- Two password sign-ins resolve to distinct user IDs and access JWTs.
- Each account completes its own profile through complete_mygram_profile.
- Private profile details cannot be read or modified by the other account.
- Profile updates cannot cross user ownership.
- verified_contact_method and contact_verified_at cannot be written by a browser JWT.
- A user can upload, read, and upsert their own private avatar.
- The other user cannot read, upload into, or delete that avatar.
- Temporary Storage objects are removed in a finally block.

## Three-user Messenger isolation gate (not yet executable in Staging)

A catalog inspection of every application schema in MYGRAM-STAGING on 2026-10-30 found no chat, message, conversation, participant, thread, or inbox tables and no Messenger RLS policies. Therefore no A/B/C conversation test has been run, and no passing result is claimed.

After the Messenger schema and policies are migrated to Staging, add a dedicated three-identity test using three separate confirmed QA accounts and real Auth API JWTs:

1. A creates a direct conversation with B; the conversation membership contains A and B only.
2. A and B can list, read, and send messages in that conversation.
3. C cannot list or read the conversation, retrieve messages by conversation ID, read attachment metadata or download attachments, mutate messages, change membership, or subscribe to the private Realtime channel.
4. Negative operations must be verified through REST, Storage, and Realtime APIs, not only SQL simulation.
5. Keep all test conversations and media in a dedicated Staging QA namespace and clean them up through supported APIs.

Acceptance criteria: A and B succeed; every C access path is denied or returns no rows; attempts to spoof sender_id or add C without an authorized membership flow are rejected. This gate remains blocked until the Messenger tables, foreign keys, RLS policies, and Realtime channel authorization exist in Staging.

## What it does not verify

The suite does not read email inboxes. SMTP delivery, signup confirmation-link receipt, and password-reset delivery require a separate mailbox-backed test. The current test users must already be confirmed in Staging.

## Local execution

    npm run test:integration

Run only against Staging and only with dedicated QA accounts.
