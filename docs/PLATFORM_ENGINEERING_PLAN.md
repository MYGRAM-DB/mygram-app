# MYGRAM Platform Engineering Plan and Acceptance Matrix

**Status:** engineering specification, not a declaration that every item below is implemented or production-ready. This document deliberately separates live, existing foundations from work that still requires code, provider credentials, security review, and real-user acceptance tests.

## Current verified foundations

- Supabase project has RLS enabled on the public tables inspected during this audit.
- Existing tables include `profiles`, `posts`, `post_comments`, `post_reactions`, `friend_requests`, `direct_messages`, `chat_messages`, `chat_members`, `chat_messages`, `notifications`, `profile_private_details`, `user_preferences`, `supported_locales`, `supported_countries`, and messaging/call-related tables.
- The live database reported 60 supported locale rows, 205 country rows, and 2,820 translation catalog rows. These counts do **not** prove that every UI string is translated or that each locale is linguistically complete.
- GitHub Actions runs Playwright browser tests and JavaScript syntax checks. Existing browser tests may mock Supabase; passing them does not prove real provider, RLS, storage, or cross-account behavior.
- Profile onboarding work is isolated on `fix/audit-chat-search-hardening`; it has not been merged or deployed from this branch.

## 1. Posts, comments, and reactions

### Required behavior
- Create, read, edit, and delete posts with ownership checks; validate text length and media metadata on both client and server.
- Comments use a self-referencing `parent_comment_id` (nullable) with a maximum supported nesting depth defined by product policy. Reject cross-post parents and cycles.
- Reactions are unique per (user, target, reaction type) according to the product model; use a unique constraint to prevent duplicates under concurrent requests.
- Realtime is a delivery optimization, not an authorization boundary. Every subscribed table must have RLS and clients must handle reconnect, duplicate events, and deleted rows.

### Minimum acceptance tests
- Anonymous users cannot mutate social data.
- User A cannot edit/delete User B's post or comment.
- A reply cannot point to a comment belonging to another post.
- Two simultaneous identical reactions result in one logical reaction.
- Realtime events do not reveal private rows to a non-member.

## 2. Messaging, privacy, and media

- Direct conversations must be distinct from group conversations. Reuse a direct conversation only when its participant set is exactly the authenticated user and the selected peer and `is_group = false`.
- Every read/write policy must validate conversation membership. Sender identity comes from `auth.uid()`, never from a trusted client-supplied user ID.
- Uploads require an authenticated owner-scoped path, size/MIME allow-list, and Storage policies for upload, read, and delete. Private media should use private buckets and short-lived signed URLs; do not expose permanent public URLs for private messages.
- WebRTC signaling records are untrusted signaling data, not proof of call membership. Validate room membership and caller/callee identities for every signal.
- TLS protects transport. It is not end-to-end encryption. Do not describe messaging as E2EE unless key generation, device key storage, identity verification, multi-device behavior, recovery, and protocol review are implemented and tested.

### Minimum acceptance tests
- A non-member cannot list messages, fetch media, or send call signals.
- A group conversation is never reused as a one-to-one conversation.
- Revoked members lose access immediately according to the product's documented retention policy.
- Unsupported file types, oversize uploads, and forged sender IDs are rejected.

## 3. Friend graph, search, and recommendations

- Friend requests must enforce no self-request, one pending request per unordered pair, and valid state transitions. Accepting a request creates one friendship relation according to the schema design; repeated accept operations are idempotent.
- Search inputs must be length-limited and normalized. Never concatenate raw user input into PostgREST `.or()` filter syntax; escape filter metacharacters or use parameterized RPC/full-text search.
- Recommendations must exclude the current user, blocked users, existing friends, and pending requests where appropriate. Apply privacy preferences before ranking; never reveal private location or private interests.
- Ranking may combine shared interests, declared country/region, and mutual connections, but should avoid inferring sensitive attributes.

### Minimum acceptance tests
- Duplicate and reciprocal requests cannot create duplicate edges.
- Blocked users are not returned in search/recommendations where block semantics require exclusion.
- Query strings containing commas, parentheses, quotes, percent signs, and wildcard characters cannot alter filter logic.

## 4. Supabase RLS and security review

- Keep RLS enabled on all exposed tables. Prefer least-privilege policies scoped to `auth.uid()`, ownership, and membership.
- Audit `SECURITY DEFINER` functions for explicit authorization, fixed safe `search_path`, schema-qualified objects, and minimal grants. A function being callable by authenticated users is not sufficient authorization.
- Do not add broad `USING (true)` policies to private data. Multiple permissive policies combine permissively; review the effective OR behavior.
- Keep service-role keys and provider secrets out of browser files, Git history, build artifacts, and client logs.
- Use migrations for schema/policy changes and test them against a disposable project before applying to production. Never disable RLS as a troubleshooting shortcut.

### Required security sign-off
1. Enumerate policies for every table and Storage bucket.
2. Inspect function definitions and grants for meeting and messaging RPCs.
3. Run Supabase Security and Performance Advisors.
4. Test as anonymous, User A, User B, conversation member, non-member, and moderator.
5. Record each finding, severity, reproduction, migration, and regression test.

## 5. Testing strategy

- Unit tests: validation, username normalization, search sanitization, friend state transitions, locale fallback, and recommendation exclusions.
- Browser tests: signup, confirmation redirect, onboarding save, profile completion redirect, post CRUD, comments/reactions, friend requests, direct/group chats, media upload, language switching, and responsive layouts.
- Integration tests against a disposable Supabase project: RLS, database constraints, Storage policies, Realtime membership, and RPC authorization.
- Real-provider acceptance tests: email delivery/confirmation/reset, SMS OTP, OAuth callback, calls, and payments. Mark provider tests as skipped/not configured when credentials are absent; never report mocks as real-provider success.
- CI must fail on JavaScript syntax errors and failed browser tests. Store Playwright reports as artifacts for failed runs.

## 6. API and data access contract

MYGRAM currently uses a static client-side application and Supabase JS rather than a single custom REST API. The effective operations are Supabase table/RPC/Storage requests, and their exact authorization comes from live schema, grants, RLS policies, and Storage policies. Do not document invented `/api/*` routes as implemented endpoints.

For each operation, maintain a table with: client operation, target table/RPC/bucket, required auth state, ownership/membership rule, request validation, success response, expected errors, and regression test. Any future Edge Function must validate JWT/auth identity, input schema, rate limits, and authorization server-side.

## 7. Localization: 60 languages

- Locale row count is only a catalogue count. Translation coverage must be measured against a canonical source-key set across all UI bundles.
- Keep one locale active at a time; never mix fallback-language strings into a selected locale silently. Missing keys should be surfaced in development/CI and use a documented fallback only in production.
- Include locale metadata (BCP 47 tag, native name, text direction, plural rules, date/number formatting) and test RTL/LTR layouts.
- CI should compare every locale key set to the canonical key set, reject empty values and accidental Arabic/English mixed placeholders, and report coverage percentages.
- Machine-generated translations require native review for high-visibility flows, safety notices, billing, and consent.

## 8. Phone authentication and SMS OTP

- Supabase Phone Auth requires an enabled phone provider and an SMS provider configured in Supabase. Store provider credentials only in provider/Supabase secrets, never in `config.js`.
- UI flow: normalize phone to E.164 using selected calling code, request OTP, show neutral errors, verify OTP, refresh session, then route to onboarding if the profile is incomplete.
- Apply resend cooldowns, attempt limits, abuse monitoring, and clear costs/consent disclosure. Test with provider test numbers before real numbers.
- Until an SMS provider is configured and a real OTP round-trip passes, mark phone signup **not verified**.

## 9. WebRTC calls, live streaming, and contacts

- Use a managed SFU/RTC provider or deploy and operate one; browser peer-to-peer alone is not a production broadcast architecture. TURN is required for reliable connectivity across restrictive NATs.
- Signaling, room membership, permissions, ICE configuration, reconnect behavior, call teardown, abuse controls, and consent indicators need integration tests.
- Live streaming needs ingest/egress, recording/retention policy, moderation, bandwidth limits, and operational monitoring.
- Contact import must be explicit opt-in, use browser/platform permission APIs, minimize uploaded fields, hash/normalize matching identifiers server-side where feasible, and provide deletion/opt-out. Never scrape contacts or upload the address book silently.
- Real calls/live streams are not complete until tested on multiple real devices and networks.

## 10. Subscriptions and monetization

- Choose a payment provider available in the operating countries and confirm platform/legal restrictions before implementation.
- Checkout and subscription state must be server-verified via signed webhooks with replay/idempotency protection. Never trust a client success redirect as proof of payment.
- Store provider customer/subscription IDs and lifecycle states, not card data. Use the provider's hosted checkout/payment elements and customer portal where possible.
- Define plans, trials, cancellations, grace periods, refunds, taxes, chargebacks, creator payout rules, fees, and ledger reconciliation before launch.
- Keep test-mode credentials in secrets; run webhook signature and duplicate-event tests. No live charges until compliance and provider acceptance are complete.

## Release gate

Do not merge or deploy until: all CI checks pass; migrations and RLS have been reviewed; critical user flows pass in an integration environment; the PR has been reviewed; and every external provider-dependent item is either verified with real credentials or explicitly marked unavailable. A green mocked browser suite alone is not a production-readiness sign-off.
