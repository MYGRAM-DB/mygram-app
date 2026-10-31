# MYGRAM X11 — Parallel Execution Report
**Date:** 2026-10-31  
**Repository:** `MYGRAM-DB/mygram-app`  
**Integration branch:** `rebuild/phase-a-architecture`  
**Authority:** X11; Orders 18–20; Decision 15/16/17; MYGRAM X10  
**Report type:** Execution evidence checkpoint, not an acceptance or release certificate

## 1. Executive status

X11 execution has started across independent W10/Security, Database, FB, Messenger and Android lanes. The first source hardening changes are committed to the W10 development branch and passed exact-head CI. Read-only Staging schema and migration checks were refreshed. Two Database design proposals were written on this isolated documentation branch.

**No user journey is accepted under the X10/X11 definition. Gate A remains OPEN. Release Ready is NO. Production remains READ-ONLY.**

| Work lane | Current status | Verified output | Acceptance boundary |
|---|---|---|---|
| W10 shared platform | implementation-in-progress | OIDC policy hardening, AuthZ integration fixture correction, exact-head CI Run #172 | Source/CI only; no runtime Gate A |
| Security / Gate A | implementation-in-progress, runtime blocked | shared OIDC trust now fails closed pending immutable workflow SHA approval; source tests pass | No deployed provenance, no QA invocation, no independent security review |
| Database | design-verified / implementation blocked | fresh read-only schema inventory; proposal docs for #93 and #95; missing-source branch/history scan | No migration file generated or applied |
| CI/CD | partial | Run #172 SUCCESS on exact W10 head; central unit/browser/Deno/build checks | PR #96 has no run/status; no privileged Staging CI execution |
| W1 FB | partial | PR #91 CI Run #156 SUCCESS; Decision 15 semantics recovered; #93/#95 proposals | No authenticated FB A/B/C journey accepted |
| W2 Messenger | partial | PR #92 CI Run #157 SUCCESS; W10 QA function source has robust cleanup logic | No deployed-source parity or current Staging runtime acceptance |
| Android | partial | PR #59 Run #9 SUCCESS; source artifact hash verified and static-reviewed | Generated native source not committed; no physical-device acceptance |
| W3–W9, W11–W13 | not-started for acceptance | Existing workshop issues and isolated branches are present | No PR or accepted journey recorded for these workshops |

## 2. W10 source changes and exact CI evidence

**Development PR:** [#90 — W10 Platform Contracts](https://github.com/MYGRAM-DB/mygram-app/pull/90)  
**Branch:** `feature/workshop-platform-contracts`  
**Exact head SHA:** `f8465e1dc2eafe58d1fed155118eafb33a22e9dd`

Three source/test changes were added on the W10 branch:

1. `supabase/functions/_shared/github-oidc-policy.mjs` now requires exact equality to an approved immutable `workflow_sha`, rather than accepting any syntactically valid 40-character SHA.
2. `tests/github-oidc-policy.test.mjs` asserts that the trusted workflow remains fail-closed while the immutable pin is unset, and rejects arbitrary SHA-shaped values.
3. `tests/authz.integration.mjs` no longer attempts private-details fixture INSERT/DELETE with ordinary user JWTs. It requires pre-provisioned fixtures and independently checks that temporary Storage objects are absent after cleanup.

The workflow SHA pin is intentionally `null` pending Security approval of the exact trusted workflow revision. This is a deliberate deny-by-default state. Neither QA function should accept an OIDC request until the immutable workflow SHA is reviewed and pinned.

**Exact-head CI:** [Run #172](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41227712421)  
**Result:** SUCCESS on exact head `f8465e1dc2eafe58d1fed155118eafb33a22e9dd`.

| Check in Run #172 | Result | Evidence boundary |
|---|---|---|
| Unit / contract tests | 18 passed, 0 failed | Includes fail-closed OIDC policy tests |
| Playwright browser baseline | 7 passed | Local browser baseline, not Staging product acceptance |
| AuthZ integration source check | Passed | `node --check` syntax only |
| Messenger integration source check | Passed | `node --check` syntax only |
| Deno typecheck: `qa-authz-two-user` | Passed | Source typecheck only |
| Deno typecheck: `qa-messenger-abc` | Passed | Source typecheck only |
| TypeScript + Vite production build | Passed | Build validation only |

The run did **not** invoke either Staging QA function, deploy an Edge Function, write to Staging, prove deployed-source parity, or close Gate A.

### Current Staging Edge Function inventory

- `qa-messenger-abc`: ACTIVE, version 5, `verify_jwt=false`, deployed bundle digest `0868b0afefd8cd5969185c4f9f350373640c83c3a76edfad508932c17acbc6a7`.
- `qa-authz-two-user`: not present in the current Edge Function listing; it remains source-only.
- The deployed bundle digest is not a Git commit SHA and does not prove source parity.
- The shared policy's unset workflow SHA means the reviewed source is fail-closed until Security supplies the exact pin. No QA function was invoked or deployed.

The W10 branch source also contains server-admin-only QA fixture creation and independent user-JWT assertions in `qa-authz-two-user`, refresh-token revocation coverage, and isolated cleanup/absence checks in both QA functions. These remain source-level evidence until the deployed functions are independently proven to match and are run under an approved trusted workflow.

## 3. Fresh Staging database inventory — read-only

**Project ref:** `cbyvtehvaojxfcgpelir` (MYGRAM-STAGING).  
**Method:** Supabase migration/table inventory plus SELECT-only catalog queries. No write statement was issued.

| Inventory item | Fresh result |
|---|---:|
| Applied migration ledger entries | 17 |
| Public base tables | 15 |
| Public views | 1 |
| Public RLS policies | 32 |
| Public base tables with RLS enabled | 15 / 15 |
| SQL migration files in integration branch | 12 |
| Applied versions with no matching source SQL in integration | 5 |

The three broad FB SELECT policies still use permissive authenticated `USING (true)`:
- `posts_select_authenticated`
- `post_comments_select_authenticated`
- `post_reactions_select_authenticated`

The `posts` table still has no `visibility`, `audience` or `privacy` column. Existing policy behavior therefore does not enforce the approved Private/Public contract.

### Five missing migration sources

These versions are present in the Staging ledger but their SQL files are absent from the integration source:

1. `20261029200719_create_profile_for_new_auth_users.sql`
2. `20261029200728_revoke_public_execute_handle_new_user.sql`
3. `20261029211249_mygram_staging_profiles_rls_core.sql`
4. `20261029223828_create_supported_locales_public_read.sql`
5. `20261030194646_enable_messenger_postgres_changes.sql`

A repository-wide source search was performed against 17 reachable branch trees; none contained these five paths. GitHub path-history queries returned zero commits for each exact path. The `main` branch tree endpoint did not resolve in this scan, so it is not counted as a successfully inspected tree. **No source was recovered, reconstructed or fabricated.** Migration history was not rewritten.

### FB comment integrity preflight

Fresh read-only checks show:
- `post_comments` has zero rows at the inspection snapshot.
- The current parent FK is single-column `parent_comment_id -> post_comments.id`, with `ON DELETE CASCADE`.
- No composite unique key on `(id, post_id)` exists.
- Preflight counts: 0 nested rows, 0 direct self-parent rows, 0 cross-post parent rows.
- Existing indexes include `parent_comment_id`, `(post_id, created_at)`, `user_id`, and the primary key on `id`.

The zero-row preflight must be repeated immediately before any future approved migration.

### Storage snapshot

Both `profile-avatars` and `messenger-attachments` are currently private buckets. No bucket setting or policy was changed. Signed URL expiry/renewal and authorization after membership/session revocation remain runtime acceptance tasks.

## 4. Database proposals delivered

Two proposal documents were added on this X11 documentation branch:

- [Issue #93 — FB audience/RLS proposal](../database-proposals/ISSUE-93-FB-AUDIENCE-RLS.md)
- [Issue #95 — same-post nested-comment integrity proposal](../database-proposals/ISSUE-95-SAME-POST-COMMENT-INTEGRITY.md)

### #93 feed audience contract

The exact product semantics were recovered from `docs/DECISION-15-FEED-VISIBILITY-AND-GATE-A.md`:
- Public = all authenticated MYGRAM accounts.
- Private = owner only.
- Comments and reactions inherit parent-post visibility.
- New posts default Private.
- Friends-only is deferred.
- Anonymous access is not included.

This resolves the semantic ambiguity, not the database implementation. The three broad policies must be replaced/narrowed, never supplemented by another permissive policy. No migration was created or applied.

### #95 same-post nested comments

The proposal specifies a composite self-FK `(parent_comment_id, post_id) -> (id, post_id)`, preserving cascade behavior; direct self-parent rejection; longer-cycle rejection; validation before removal of the old FK; and a fail-closed rollback plan. It is a design document, not executable migration SQL.

## 5. PR and CI ledger

All seven pre-existing PRs listed below remain OPEN / DRAFT / NOT MERGED at this checkpoint.

| PR | Workstream | Exact head SHA | Latest exact-head run | Result |
|---|---|---|---|---|
| [#54](https://github.com/MYGRAM-DB/mygram-app/pull/54) | Foundation / integration branch | `c797e293f23fbc337510a95e7a051b42f72bfef7` | #133 | SUCCESS; historical Messenger A/B/C evidence is not current Gate A |
| [#59](https://github.com/MYGRAM-DB/mygram-app/pull/59) | Android | `f2edc7fcc28c971bad4914c80b7408998da84218` | #9 | SUCCESS; ephemeral Debug build |
| [#87](https://github.com/MYGRAM-DB/mygram-app/pull/87) | GLOBAL 90 docs | `d5db6fd181d67609cd657ed532e257e4668b711e` | None found | No exact-head run/status found |
| [#90](https://github.com/MYGRAM-DB/mygram-app/pull/90) | W10 platform / CI | `f8465e1dc2eafe58d1fed155118eafb33a22e9dd` | #172 | SUCCESS |
| [#91](https://github.com/MYGRAM-DB/mygram-app/pull/91) | W1 FB | `d5a2f6c657986c51a232ef1b5826cb7b3d4265d9` | #156 | SUCCESS; not authenticated FB acceptance |
| [#92](https://github.com/MYGRAM-DB/mygram-app/pull/92) | W2 Messenger | `02a83a6dba6d7d5299bd4043b516db40060f3c7b` | #157 | SUCCESS; not Staging runtime acceptance |
| [#96](https://github.com/MYGRAM-DB/mygram-app/pull/96) | X10 documentation only | `0e14501a9cc182367cf95e0104caef63e782adca` | None found | Zero workflow runs / zero commit statuses |

Run #133's earlier 11/11 Messenger A/B/C result remains historical evidence on the legacy OIDC path. It is not a current trusted-workflow run and does not satisfy Gate A.

The X11 report and the two Database proposals in this document are delivered separately through [PR #97](https://github.com/MYGRAM-DB/mygram-app/pull/97), which remains OPEN / DRAFT / NOT MERGED. Its exact head, blob SHA, branch comparison and no-CI status are recorded in the PR description and the X11 delivery comment on Issue #94.

PR #96 remains the X10 report PR only. It was not edited by X11. Its last verified branch comparison was 4 ahead / 0 behind; verify again before any future decision. It remains documentation-only, OPEN / DRAFT / NOT MERGED.

### CI trigger boundary for documentation PRs

PR #96 and PR #97 both have zero workflow runs and zero commit statuses on their exact heads. The inspected `.github/workflows/ci.yml` on the current integration branch still declares `pull_request.branches: ["main"]`. Since these documentation PRs target `rebuild/phase-a-architecture`, that base-branch filter does not select them. W10 PR #90 contains the intended integration-branch trigger in its own branch and Run #172 passed there, but that workflow change is not yet present on the integration branch. CI owner must decide the safe required-check path; no manual dispatch or workflow-policy change was made in this X11 cycle.

### Formal review state

| PR | Submitted review state | Interpretation |
|---|---|---|
| #90 W10 | Two `COMMENTED` reviews by `MYGRAM-DB`, the PR author | Review comments, not independent approval |
| #96 X10 report | No submitted reviews | Pending |
| #97 X11 report/proposals | No submitted reviews | Pending |

No formal independent Security or Database approval is recorded for these deliveries. Review requests and issue comments are not approvals. Workshop issues #73–#85 have no assigned human assignees at this checkpoint.

## 6. Workshop register W1–W13 and Android

The existing workshop branches and issues were checked. The workshop issues #73–#85 remain OPEN and have no assigned human assignees. Branch existence is not evidence that a person is working or that a product journey is accepted.

| Workshop | Product | Branch head SHA | PR / evidence | Status |
|---|---|---|---|---|
| W1 | MYGRAM FB | `d5a2f6c657986c51a232ef1b5826cb7b3d4265d9` | PR #91 / Run #156 | partial |
| W2 | MYGRAM Messenger | `02a83a6dba6d7d5299bd4043b516db40060f3c7b` | PR #92 / Run #157 | partial |
| W3 | WHATSMYGRAM | `3693b48dacdd36b0a44825fba7f7560241c96faa` | Issue #75; no PR | not-started for acceptance |
| W4 | MYGRAM Insta | `b4200056843cce5045fc151af57e1339bf0ba6be` | Issue #76; no PR | not-started for acceptance |
| W5 | MYGRAM Twitty | `a88cfd9cb1e2de7f9b580c2063ac6e5903bb964d` | Issue #77; no PR | not-started for acceptance |
| W6 | MYGRAM Meeting | `059a62a934cea2bb3528575e24fce15262644211` | Issue #78; no PR | not-started for acceptance |
| W7 | MYGRAM Tube | `e97c095ba9694a4679aa13f331117280d61404ad` | Issue #79; no PR | not-started for acceptance |
| W8 | MYGRAM TikToks | `682a845071e397cbcb07dca6f404dd391085fafc` | Issue #80; no PR | not-started for acceptance |
| W9 | MYGRAM AI | `2a760f367ccfbb6a681d51633dc9b9df65bfadf9` | Issue #81; no PR | not-started for acceptance |
| W10 | Shared platform | `f8465e1dc2eafe58d1fed155118eafb33a22e9dd` | PR #90 / Run #172 | implementation-in-progress |
| W11 | Localization | `f6ac6e8d3a7862f84f7e2ed96fbd83400e69f649` | Issue #83; no PR | not-started for acceptance |
| W12 | Marketplace / ads | `f339d01cf00db51dc1b1bc8c8bbc0baf7b4b69ca` | Issue #84; no PR | not-started for acceptance |
| W13 | Admin / operations | `e129b14b802ff88bd8e433592fb86c748a03f702` | Issue #85; no PR | not-started for acceptance |
| Android | Native Staging app | `f2edc7fcc28c971bad4914c80b7408998da84218` | PR #59 / Run #9 | partial |

### Android source artifact review

The existing workflow artifact was downloaded and inspected:
- Artifact ID: `13036279372`.
- Outer archive SHA-256: `2b40287e7769834b2714623368c723d0c53624b21713a28aa400a321ba2cc75c` (matches the PR #59 artifact digest).
- Nested `android-source-review.zip` SHA-256: `ce7cfe959d07b29191446c568d2bbd9ff398434b41989611f2946e433bb24aa1`.
- Static scan found no `sb_secret_` pattern or Production project reference; the manifest has only Internet permission and `allowBackup=false`.
- The generated Android source and `package-lock.json` remain artifact-only, not committed to PR #59.
- The current inspection environment has no Android SDK path configured and no physical device attached. No device, PKCE deep-link, login, keyboard or RTL test was run here.
- Run #9 proves an ephemeral GitHub-runner Debug APK build only. It is not physical-device acceptance or release signing.

## 7. P0 / P1 / P2 blockers and next actions

### P0 — acceptance blockers

| Blocker | Owner | Next verifiable action |
|---|---|---|
| OIDC workflow SHA is deliberately unpinned; QA fail-closed | Security + W10 | Independently approve exact trusted workflow revision and pin its immutable SHA; then positive/negative/replay/untrusted-source tests |
| QA AuthZ not deployed or invoked; deployed source parity unproven | Security + W10 | Establish source provenance, separate review, and approved Staging runtime plan; do not activate the flag yet |
| Access-token expiry not tested; refresh revocation is not immediate JWT revocation | Security | Design a bounded, reproducible expiry test without changing Auth settings; test session_id/revocation semantics accurately |
| Broad FB SELECT policies and no audience column | Database + W1 + Security | Approve #93 proposal, prepare reviewed migration after migration-source reconciliation, then real A/B/C tests |
| Five applied migrations lack original SQL source | Database | Continue provenance search; recover originals with SHA-256 or submit a reviewed baseline exception and validator |
| Nested comments lack same-post integrity FK | Database + W1 | Review #95 proposal, generate migration only through approved CLI and only after preflight/approval |
| Independent Security and Database reviews | Security + Database | Submit formal PR reviews with exact SHA and findings |

### P1 — operating requirements

- Messenger: authenticated Staging A/B/C, Realtime reconnect and revocation, attachment upload cleanup, signed URL expiry/renewal, rapid conversation switching and pagination E2E.
- Android: commit generated native source and lockfile to its isolated branch, implement PKCE email/recovery deep links, rebuild from clean checkout, test on owner-controlled physical device including Arabic RTL.
- CI: preserve central W10 ownership; ensure required checks bind to exact PR head and fail closed if missing.
- W3–W9 and W11–W13: appoint accountable human implementers/reviewers and publish one independently testable vertical-slice plan per workshop; do not treat branch existence as execution.

### P2 — product quality

- Localization completeness and mixed-direction/placeholder tests.
- Performance, responsive UI, accessibility and failure/retry states.
- AI, Meeting, media processing and Marketplace/ads remain provider/cost/privacy gated. No paid provider activation, wallet or payment action.

## 8. Task and test ledger

| Evidence item | Count | Result |
|---|---:|---|
| W10 source/test files changed in this X11 cycle | 3 | committed on PR #90 branch |
| Unit/contract tests in Run #172 | 18 | all passed |
| Playwright baseline tests in Run #172 | 7 | all passed |
| QA Edge Function Deno typechecks in Run #172 | 2 | both passed |
| AuthZ/Messenger integration source checks | 2 | syntax checks only |
| Database proposal documents created | 2 | proposal-only |
| Missing migration sources recovered | 0 | unresolved |
| Staging QA functions invoked in this X11 cycle | 0 | not authorized/performed |
| Staging/Production writes or migrations | 0 | none |
| User journeys accepted under X10/X11 | 0 | no acceptance evidence complete |

No completion percentage is published because no approved weighted acceptance scorecard has been defined. Counting files, branches or commits would misrepresent engineering acceptance.

## 9. Safety and governance log

No Staging or Production environment mutation occurred: no database writes or migrations, no RLS/Auth/Storage/Realtime changes, no Edge Function deployment or Secret changes, no QA invocation, merge, auto-merge, invitations, APK distribution, public release, paid provider activation, Wallet or Payments action. GitHub source changes are confined to the isolated W10 development branch and the X11 documentation branch.

PR #96 remains unchanged and OPEN / DRAFT / NOT MERGED. PR #90 remains OPEN / DRAFT / NOT MERGED. All other PRs remain unmerged. The X11 report is a coordination/evidence artifact, not a release certificate.

## 10. Immediate next sequence

1. Security reviews the W10 OIDC change and supplies the exact immutable workflow SHA pin decision. Until then, QA remains fail-closed.
2. Database reviews the #93 and #95 proposals; migration-source reconciliation remains a prerequisite to any migration application.
3. W1/W2 continue product-specific browser and runtime test design without waiting on the DB migration; affected privacy journeys remain blocked from acceptance.
4. Android owner commits and reviews the native source artifact on its isolated branch; physical-device tests require an owner-controlled device.
5. W3–W9 and W11–W13 owners begin their independent design/contract/test slices and report exact SHAs and evidence.
6. W10 keeps central CI ownership and updates the single evidence ledger with exact-head run IDs and accepted journeys only.

**X11 checkpoint decision:** parallel execution has begun and produced source-level and proposal-level outputs. Gate A is not closed; no product is declared release-ready.
