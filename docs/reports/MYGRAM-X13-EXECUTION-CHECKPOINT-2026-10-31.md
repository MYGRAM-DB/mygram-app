# MYGRAM X13 execution checkpoint

**Date:** 2026-10-31  
**Repository:** `MYGRAM-DB/mygram-app`  
**Integration target:** `rebuild/phase-a-architecture`  
**Execution scope:** isolated source branches and local, read-only verification. No live environment changes.

## Executive disposition

X13 has produced two additional functional source changes:

1. Messenger now preserves the message timeline when older-page and newest-page/Realtime responses finish out of order.
2. Facebook Feed now has deterministic keyset pagination using `created_at + id`, deduplicated page merging, and a Load Older control.

Both changes have local Node 22 isolated harness results. Neither current PR head has a GitHub Actions run because the integration branch's central workflow still targets PRs to `main` only. The W1/W2 branches no longer modify `.github/workflows/ci.yml`; central CI ownership remains with W10.

No Staging runtime journey was executed. No journey is accepted. Gate A remains OPEN; Release Ready remains NO.

## W2 Messenger

**PR:** #92, OPEN / DRAFT / NOT MERGED  
**Branch:** `feature/workshop-messenger`  
**Current head:** `bdbe9659781df8c2201a4dbec01d89f20b31ec34`

### Implemented
- Same-conversation concurrent page/Realtime reads no longer invalidate one another by incrementing a shared request version.
- The request generation is now invalidated by conversation changes/unmount, not by every page request.
- Every successful response merges into the current timeline, preserving older pages if a Realtime refresh completes first.
- Existing deduplication and deterministic `created_at + id` ordering remain in use.
- Added a regression test simulating both completion orders and asserting identical, duplicate-free timelines.
- X12 attachment compensation remains in the branch: file-only failure cleanup, text-plus-file preservation, and explicit cleanup-failure reporting.

### Verification
- Isolated Node 22 harness copied from the current branch helper and corresponding test cases: **8/8 passed**.
- This is not a repository checkout, full `npm test`, TypeScript build, browser E2E, CI, or Staging runtime result.
- No CI run exists for the current PR head.

### Not yet proven
Real upload fault injection, attachment metadata failure against Supabase, A/B/C live isolation, Realtime disconnect/reconnect, Signed URL expiry/renewal, and full user journey.

## W1 Facebook Feed

**PR:** #91, OPEN / DRAFT / NOT MERGED  
**Branch:** `feature/workshop-fb`  
**Current head:** `e3da32d81405e70c4bc04ba8c2cd7f1a2a1ba44e`

### Implemented
- Posts are queried in stable descending order by `created_at` then `id`.
- Older pages use a compound keyset cursor: earlier timestamp, or equal timestamp with a lower ID.
- Page merge deduplicates by post ID and maintains deterministic ordering for timestamp ties.
- Refreshes after create/edit/comment/reaction preserve already loaded older pages.
- Successful deletion removes the deleted post from local state before refresh.
- Added tests for stable ordering, overlap deduplication, and invalid timestamps.

### Verification
- Isolated Node 22 harness copied from the current branch helper and corresponding test cases: **4/4 passed**.
- This is not a repository checkout, TypeScript build, browser E2E, CI, or Staging runtime result.
- No CI run exists for the current PR head.

### Privacy boundary
No Public/Private selector was introduced. The audience schema and broad authenticated SELECT policies remain blocking evidence from X11/X12. The Feed cannot be privacy-accepted until Database/Security deliver and validate the audience policy design and A/B direct-API tests.

## W10 / OIDC and CI ownership

**PR:** #90, OPEN / DRAFT / NOT MERGED  
**Head:** `d9a8dbe667d1a2d83ab54016e0b70a4779d2c7b6`

- Existing exact-head Run #41232812451 remains successful: 19/19 Node tests, 7/7 Playwright baseline tests, Deno QA-function checks, TypeScript and build.
- `workflow_sha` remains null and fail-closed. No Security approval or immutable pin was invented.
- PR #90 has COMMENTED reviews only; no independent approval is recorded.
- PR #90 is the sole owner of central CI changes.
- W1/W2 branches were restored so their `.github/workflows/ci.yml` files match the integration branch exactly. Neither PR changes the central workflow.
- Current integration workflow still filters PRs to `main`; therefore current W1/W2 heads have no exact-head CI run.
- I did not manually dispatch the existing workflow because its current integration-branch definition includes a Staging QA invocation and X13 does not authorize that operation.

## Database, Android, and protected environments

- Issue #93 and #95 remain design-only. No SQL migration was created or applied.
- The five previously identified migration sources remain unrecovered; no substitute SQL was authored.
- Android PR #59 remains OPEN / DRAFT. Existing Runner build is not emulator/device acceptance; no APK was distributed.
- No Staging or Production writes, migrations, policy/Auth/Storage/Realtime changes, Edge Function deployments, secrets changes, QA invocations, or tester invitations occurred.

## Acceptance ledger

| Journey | Current evidence | Acceptance |
|---|---|---|
| Messenger: open conversation, send/receive text and attachment, maintain timeline | Source changes + 8/8 isolated helper tests; no runtime journey | NOT ACCEPTED |
| Feed: create/read/update/delete/comment/react and page through feed | Existing UI source + pagination change + 4/4 isolated helper tests; no runtime journey | NOT ACCEPTED |
| AuthZ A/B/C | W10 source/CI evidence only; no Staging execution | NOT ACCEPTED |
| Android sign-in and navigation | Runner artifact only; no emulator/device run | NOT ACCEPTED |

**Accepted user journeys: 0.**

## Next exact actions

1. W10/CI owner: provide a safe exact-head CI path for PRs targeting `rebuild/phase-a-architecture`, without invoking Staging QA or weakening branch protection.
2. Security: independently review W10 OIDC and approve or reject a specific immutable workflow revision; keep the pin null until then.
3. W2: once the safe CI path exists, run exact-head unit/build/Playwright; then request explicit authorization for controlled Staging A/B/C and failure-injection testing.
4. W1 + Database/Security: resolve Issue #93 audience schema/RLS contract before exposing privacy controls; then run direct API tests with independent A/B accounts.
5. Android: continue source organization and reproducible build preparation; emulator/device evidence remains separate.

**Final status:** source-level progress on W1/W2; local helper tests passed 12/12 across two isolated harnesses; no exact-head CI for the new W1/W2 heads; zero accepted user journeys; Gate A OPEN; Release Ready NO.
