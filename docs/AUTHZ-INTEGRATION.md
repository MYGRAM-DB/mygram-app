# Staging Auth/RLS/Storage Integration Test

The automated suite in tests/authz.integration.mjs is restricted to two dedicated, email-confirmed QA users in MYGRAM-STAGING.

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

## What it does not verify

The suite does not read email inboxes. SMTP delivery, signup confirmation-link receipt, and password-reset delivery require a separate mailbox-backed test. The current test users must already be confirmed in Staging.

## Local execution

    npm run test:integration

Run only against Staging and only with dedicated QA accounts.
