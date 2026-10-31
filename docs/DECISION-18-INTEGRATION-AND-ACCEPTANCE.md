# MYGRAM | DECISION 18 — From Workshop Helpers to Integrated Product Slices
**Date:** 2026-10-31  
**Repository:** `MYGRAM-DB/mygram-app`  
**Integration branch:** `rebuild/phase-a-architecture`  
**Parent portfolio:** Issue #58  
**Previous orders:** Decisions 11–17  
**Workshop branches:** #73–#85

## 1. Verified disposition of the 13 workshop deliveries

The reported 13 workshop CI successes are independently confirmed.

| Workshop | Branch | Verified head / CI SHA | Run |
|---|---|---|---:|
| FB | `feature/workshop-fb` | `499e05b3c572fe01c5e0f05fe02c474fdc6be3a0` | [41191403262](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191403262) |
| Messenger | `feature/workshop-messenger` | `713a9c0602d71183e2ffef5b820982c6228143e0` | [41191412147](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191412147) |
| WHATSMYGRAM | `feature/workshop-whatsmygram` | `e5c53a66ae550b1d2d76fa71fb0d9ea70481fe98` | [41191420581](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191420581) |
| Insta | `feature/workshop-insta` | `1e7404573592beeee8ef9ed4fd644598bcb57258` | [41191429304](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191429304) |
| Twitty | `feature/workshop-twitty` | `ef3bec766ef0408c6eba556a57ba067b3bdb5c7e` | [41191436972](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191436972) |
| Meeting | `feature/workshop-meeting` | `97b06c04d97365cee5000687abae0aa75b991b63` | [41191451766](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191451766) |
| Tube | `feature/workshop-tube` | `0869906d19e46d13c26f8dfdbf22d9d1a0a34ffb` | [41191459442](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191459442) |
| TikToks | `feature/workshop-tiktoks` | `71f5ae8b34cf82fcad716364e63012aa6774f99a` | [41191466828](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191466828) |
| AI | `feature/workshop-ai` | `8e825c81aafc60446061cb9abd4cbd6e31a30b3e` | [41191475717](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191475717) |
| Platform | `feature/workshop-platform-contracts` | `a7032b110e56096a86f5d5410c9ccb7fa05ba070` | [41191483269](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191483269) |
| Localization | `feature/workshop-localization` | `8918d6ac1f4c4a89ce4d2a0b4abda6bd73e16b64` | [41191500573](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191500573) |
| Marketplace/Ads | `feature/workshop-marketplace-ads` | `05f4cbdc743a7787f63b1074c7d5a9b9ccbd64fa` | [41191508651](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191508651) |
| Admin/Ops | `feature/workshop-admin-ops` | `6cf0656aa8f861778a4fa60c6043dab9d386f448` | [41191515381](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41191515381) |

Read-back confirmed that every branch head exactly matches its corresponding successful `push` run SHA. The common `.github/workflows/workshop-ci.yml` file has the same blob SHA on all 13 branches.

The diff from Decision 17's base shows each branch adds exactly three paths: the common workflow, one small `src/lib/workshops/*.mjs` helper, and one `tests/workshops/*.test.mjs` file. The helper/test additions are small pure functions and unit tests. None of the 13 branch diffs changes `src/App.tsx`, the existing React workspaces, the Supabase migrations, an Edge Function, or the existing Staging authorization tests.

### What this evidence proves

- 13 workshop-specific helper modules and their unit tests exist in isolated branches.
- The 13 corresponding workshop workflow runs completed successfully on those exact branch heads.
- The shared workflow content is byte-identical across the 13 branches.
- The first isolated code/test milestone is complete.

### What it does not prove

- No React screen or route is wired to these new helpers.
- No new helper is proven to persist data through Supabase.
- No actual A/B/C RLS, Storage or Realtime authorization test was performed by these workshop jobs.
- No video transcoding, live meeting/SFU, paid AI provider, OTP delivery, Marketplace listing backend or live ad serving is proven.
- No workshop branch has been merged. The number of product integrations completed is **zero** at this milestone.

## 2. CI correction and single-owner rule

The current `.github/workflows/workshop-ci.yml` uses one job:
1. `npm ci --ignore-scripts --no-audit --no-fund`
2. `node --test tests/workshops/*.test.mjs`
3. `npm run build`

This is valid lightweight unit/build verification, but it does not run the full existing unit suite or Playwright E2E. Each workshop branch currently adds one workshop test file; therefore its run only exercises the tests present in that isolated branch, not a consolidated set of all 13 helpers.

Orders:
- W10 owns one canonical copy of `.github/workflows/workshop-ci.yml`. The same path/blob is added in all branches; consolidate it once at integration and do not allow 13 independent workflow owners.
- Add the complete unprivileged PR gate: `npm ci`, `npm test`, install Playwright Chromium, `npm run test:e2e`, and `npm run build`. Keep existing security checks and do not silently remove old workflow jobs.
- Keep privileged Staging AuthZ invocation separate from ordinary PR validation. It may run only in a trusted workflow with exact OIDC provenance and protected source. Never expose Supabase admin credentials to untrusted PR code.
- A successful workshop run remains a unit/build result. It must not be labelled product acceptance or Gate A closure.

## 3. Required integration sequence

**I0 — Contract consolidation (W10):** publish TypeScript API/data contracts and ownership matrix for Identity/Profile, social visibility, messaging and groups, media, stories, meetings, AI request authorization, notification, localization, moderation and audit. For each contract specify version, caller, server authorization boundary, error shape, idempotency and schema owner. Verify live Staging schema read-only before referencing table names/columns. No new product invents duplicate tables or policies.

**I1 — Existing core journeys (W1 + W2):** connect FB and Messenger helper logic to real React workspace behavior and existing supported Supabase schema. Add component/browser tests, real persistence tests and negative permission cases. Preserve existing flows; do not rewrite working code for style.

**I2 — Consumer product workspaces (W3–W9):** each product gets its own React route/workspace and a typed Supabase/server adapter. Use existing schema only where verified. Where schema or provider is missing, finish the UI/domain adapter and integration contract but do not invent production behavior or claim end-to-end acceptance.

**I3 — Shared localization, Marketplace and operations (W11–W13):** connect the actual locale resources to active UI; build a persisted Listing/inquiry path and sponsored-ad test inventory only after approved data contracts; strengthen redaction and real observability before creating admin views.

**I4 — Controlled branch integration:** review one workshop PR at a time into `rebuild/phase-a-architecture`; run the consolidated full suite on each exact merge commit; update scorecard only against passed acceptance criteria. Do not merge all 13 branches in one batch.

## 4. Per-workshop next engineering orders

### W1 — FB | #73
Current React file `src/components/SocialFeedWorkspace.tsx` implements root-level comments, reactions, text post creation and owner-scoped deletion. It does not yet wire nested replies or post editing.
- Wire the existing `addReply` and `editOwnedPost` domain behavior into a real reply UI using `post_comments.parent_comment_id`.
- Implement edit-own-post in the actual Supabase flow and UI. Verify current table grants and RLS allow only the owner; if schema/policy changes are needed, submit them to #60/W10 rather than changing shared migration files independently.
- Add browser tests for root/reply nesting, author labels, save failure, double-submit, edit by owner, and attempted edit by another user.
- Add the approved Private-by-default / explicit Public selector only against the reviewed schema contract from Decision 15. Do not trust client-side checks.

### W2 — Messenger | #74
Current React file `src/components/MessengerWorkspace.tsx` supports pairwise conversations, loads at most 250 messages, uses `created_at`, and has private Storage attachments and a private Realtime channel. It does not prove group chat, read receipts or typing presence.
- Integrate `mergeMessages` into a real message-history pagination path. Do not assume a `sequence` database column exists: use verified existing `created_at` + unique `id` keyset semantics, or submit a reviewed additive schema proposal first.
- Integrate attachment transition handling into upload state and prove Storage cleanup after every failed upload/insert path.
- Fix stale async loads and Realtime callback races when rapidly switching conversations or signing out.
- Add UI tests for loading older messages, stable ordering/no duplicates, retry, expired signed URL, channel unsubscribe and participant denial.
- Group conversations, delivery/read receipts and typing/presence remain separate contracts and must not be called complete until backend policy and Realtime tests pass.

### W3 — WHATSMYGRAM | #75
- Integrate `normalizePhone` with the phone-country selector and supported calling-code metadata; keep phone country separate from nationality and residence.
- Show the distinction between a structurally valid number and a verified number.
- Add country-specific positive/negative fixtures and anti-enumeration UI/error contracts.
- Do not send SMS or upload the user's contact book. Live OTP requires provider approval, explicit consent, expiry/replay/rate-limit tests.

### W4 — Insta | #76
- Connect `storyVisible` and `activeStories` to a real product workspace only after inspecting the actual Staging stories schema and RLS.
- Fix fail-closed behavior for invalid/missing expiry timestamps; invalid dates must never turn content visible.
- Add server-enforced expiry/visibility tests, story owner controls and private-media access tests.
- Use the shared media/social contracts. No public bucket or permanent public object URL.

### W5 — Twitty | #77
- Build a real Twitty React workspace using the validated short-post/thread helpers.
- Define persistence, reply/repost/quote ownership and feed ordering through W10's social contract and reviewed schema.
- Add create/read/reply/repost UI, error/empty/pagination states and A/B/C privacy tests.
- Do not reuse FB permissions blindly or expose private posts through search/trending.

### W6 — Meeting | #78
- Build meeting scheduling, invitations, join/leave, roster, host controls and chair-transfer UI against a reviewed contract.
- Enforce role transitions on the server, not only in `transitionMeeting`.
- Add invite/non-invite, participant/host, revoked session and invalid chair-transfer tests.
- Keep audio/video provider integration behind a provider adapter. No recording or 30-person support claim until SFU, consent, cost, load and physical-device acceptance pass.

### W7 — Tube | #79
- Build a real channel/upload/job-status workspace and connect `transitionJob` to a server-owned processing job adapter.
- Make retry limits, idempotency, ownership, deletion and processing status server-enforced.
- Keep object storage private and use a single shared media pipeline.
- No claim of transcoding/adaptive streaming until a provider/pipeline is approved and runtime tested.

### W8 — TikToks | #80
- Connect the player module to a real React vertical feed with empty-state, route-change cleanup, visibility pause, accessibility controls and low-bandwidth handling.
- Fix zero-item and invalid-index state behavior; an empty feed must not claim playback is active.
- Consume the shared media path from Insta/Tube, not a separate uploader.
- Add mobile browser/device performance, memory and authorization tests.

### W9 — AI | #81
- Treat `authorizeAiRequest` as a pure validation helper only, not an authorization boundary.
- Implement a server-side Edge Function boundary that validates the Supabase JWT, derives user identity from the verified token, obtains quota from trusted server-side state, and enforces rate/quota atomically.
- Test missing/invalid JWT, user mismatch, quota race, oversized prompt, prompt injection handling, timeout and cleanup.
- Do not pass a caller-supplied `userId` or quota as proof of identity/allowance. No provider key in browser/mobile and no paid inference until owner approval.

### W10 — Platform | #82
- Expand the current minimal `contracts.mjs` into versioned TypeScript contracts used by the real product consumers.
- Publish a file/schema/API ownership matrix and version/deprecation policy.
- Define social visibility, group messaging, media access/expiry, AI scope, locale, notifications, moderation and audit contracts.
- Add contract tests for incompatible versions and forbidden owner changes.
- Own migration proposals and a read-only Migration Validator; do not invent missing migration source SQL or apply schema changes before #60 review.

### W11 — Localization | #83
- The current catalog contains only three Arabic and three English keys. Connect it to real App/workspace strings and add key parity against every active screen.
- Add missing-key fail-closed/developer diagnostics, fallback tests, placeholders/plurals and mixed-language detection.
- Make document `lang` and `dir` derive from selected locale; test Arabic RTL and English LTR with browser screenshots/assertions.
- Expand languages using approved translation resources; no claim of 60-language completion until shipped-screen coverage is measured.

### W12 — Marketplace/Ads | #84
- Build actual Marketplace workspace: seller-owned listing create/edit/archive, search/filter, listing details and buyer inquiry via Messenger's typed integration.
- Define persistence/RLS through W10; test seller ownership, visibility and revoked-user denial.
- Implement Staging-only sponsored inventory with explicit labels, moderation approval, campaign state, budget/frequency caps and auditable impressions.
- Prohibit targeting from private messages, sensitive attributes or hidden location. No wallet, billing, live charging or paid campaign activation.

### W13 — Admin/Ops | #85
- Replace shallow key-only audit redaction with recursive, allowlisted, size/depth-bounded redaction for nested values and unsafe strings.
- Add tests for nested token/password/email/phone/address fields, secret-like values in arbitrary text, arrays, circular/oversized input and null handling.
- Define structured health/error event contracts and correlation IDs; connect only to authorized server telemetry.
- Admin reads/actions must be server-authorized and audited. No Service Role key in browser, no broad user-data export, no Production mutation.

## 5. Real integration acceptance contract

No workshop can advance to `acceptance-passed` until:
1. A real UI route/workspace invokes its code module.
2. The UI calls a verified authenticated API or server function.
3. Data persists and can be read back in Staging where persistence is in scope.
4. Authorization is enforced server-side and proven with independent A/B/C identities.
5. At least one allow case and one denial/failure case pass.
6. Duplicate-submit, loading, error, retry and deletion behavior are covered where applicable.
7. Unit + browser/E2E tests run on the exact PR head SHA.
8. A reviewer checks the changed paths and data/schema contract.
9. Rollback is documented; no Production mutation is involved.

Pure helper tests retain value and remain in the suite, but do not alone earn end-to-end product delivery points.

## 6. Shared test and integration gate

Create/maintain one canonical unprivileged workflow for product PRs which runs:
- `npm ci`
- `npm test` (all existing and workshop unit tests)
- Playwright browser install and `npm run test:e2e`
- `npm run build`

Keep integration secrets out of ordinary PR workflows. AuthZ/Staging privileged tests remain a distinct trusted workflow under #60 with hardened OIDC provenance, A/B/C JWT assertions, resource cleanup and an independent human security review.

## 7. Security and release boundaries

- Gate A remains OPEN until #55/#60 acceptance passes, including real feed RLS, membership, AuthZ, Storage, Realtime, expiry/revocation and cleanup.
- Staging project `cbyvtehvaojxfcgpelir` only for approved runtime work.
- Production project `rocztskcyakvekokftfx` remains READ-ONLY.
- No unreviewed migrations, no migration-history rewrite, no RLS weakening, no public private-media bucket, no browser secrets.
- PR #54 and #59 remain Open / Draft / Not Merged.
- No tester invitations, APK distribution, public release or paid provider activation under this decision.

## 8. Required next evidence report

For each W1–W13, report one status: **Changed**, **Tested**, **Blocked**, or **Accepted**, with exact commit SHA, changed paths, linked unit/E2E test, CI run, Staging project and data evidence where applicable, reviewer, rollback and next blocker.

The next report must distinguish:
- **Helper delivered** (already proven for 13 workshops);
- **UI integrated**;
- **API/persistence integrated**;
- **Authorization tested**;
- **End-to-end accepted**.

Do not collapse these into one “completed” label.

**Final command:** Start the integration work immediately, in parallel on isolated branches. W10 controls shared contracts; W1/W2 receive first full UI/API wiring priority; W3–W9 and W11–W13 continue their product-specific consumer work without waiting where independent. One PR at a time is reviewed and integrated into the central branch. Gate A continues in parallel. No bulk merge.


## 9. Tracking issues opened

- [#88 — Integrate workshop helpers into real React and Supabase product journeys](https://github.com/MYGRAM-DB/mygram-app/issues/88)
- [#89 — Consolidate the full PR quality gate](https://github.com/MYGRAM-DB/mygram-app/issues/89)

Each workshop issue #73–#85 now has an additional comment naming the next UI/API/integration deliverable and its evidence criteria. The new comments distinguish helper delivered from UI integrated, persistence integrated, authorization tested and end-to-end accepted.

The Decision 18 commit and its existing workflow result:
- Commit: `e4a5f30c8d7be097f82b0cc948749208f339478a`
- [Run #41192057286](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41192057286): completed SUCCESS on the exact Decision 18 SHA for the two existing integration workflow jobs.

PR #54 remains Open / Draft / Not Merged; PR #59 remains Open / Draft / Not Merged. Issues #55 and #60 remain open; Gate A is not closed by workshop unit CI.
