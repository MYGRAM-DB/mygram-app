# MYGRAM X10 — Unified Engineering, Security and Delivery Evidence Report

**Report ID:** X10-UNIFIED-2026-10-31  
**Audit cut-off:** 2026-10-31, approximately 13:40–13:42 UTC. Supabase Security Advisor observations were timestamped 13:40:54Z and Performance Advisor observations 13:40:55Z. GitHub PR/CI snapshots were read during the same audit session.  
**Repository:** [MYGRAM-DB/mygram-app](https://github.com/MYGRAM-DB/mygram-app)  
**Integration branch:** `rebuild/phase-a-architecture`  
**Staging:** `MYGRAM-STAGING` / `cbyvtehvaojxfcgpelir`  
**Production:** READ-ONLY  
**Report branch:** `docs/x10-unified-evidence-2026-10-31`  
**Status:** Evidence report prepared for W10, Security and Database review. It is not an acceptance certificate.

---

## 0. Evidence method and status vocabulary

This report distinguishes:
- **Source evidence:** exact files, paths, branches, PRs and blob/commit SHAs.
- **Automated test evidence:** exact workflow run, tested head SHA, job and step results.
- **Staging runtime evidence:** an observed test invocation against the Staging project.
- **Authorization evidence:** positive and negative tests using distinct user JWTs.
- **Independent review:** a review by an authorized reviewer other than the implementation owner.
- **Acceptance:** all applicable evidence above plus failure/retry, persistence, cleanup, rollback and owner sign-off.

Allowed work statuses:
- `not-started`: no implementation evidence located for the scoped requirement.
- `design-verified`: requirements/contract are documented, but implementation is not established.
- `implementation-in-progress`: source changes exist but the vertical slice is incomplete.
- `partial`: a subset exists or passed, while required acceptance evidence remains missing.
- `acceptance-passed`: all scoped acceptance gates are evidenced on the exact tested SHA.
- `release-ready`: acceptance plus release/security/operations approvals are complete.

A green CI job does not automatically change a product to `acceptance-passed`. No workshop in this report is classified `release-ready`.

## 1. Executive summary

### 1.1 Overall state

MYGRAM is an active Staging-backed application foundation with partial FB and direct Messenger implementation, shared TypeScript contracts in progress, locale/country registries, private profile and Messenger Storage buckets, and a set of passing source/build/browser CI checks.

It is **not release-ready**. Several product surfaces remain design-only or lack verified real journeys. Security and privacy blockers remain open. The source migration inventory does not fully reconcile with the applied Staging migration ledger.

| Executive indicator | Audited result | Evidence / interpretation |
|---|---:|---|
| Open PRs discovered | 6 | #54, #59, #87, #90, #91, #92 |
| Open priority blockers in this report | 6+ | #55, #60, #88, #89, #93, #95, plus workshop Issues #73–#85 |
| Staging applied migrations | 17 | Supabase migration ledger |
| SQL migration files in integration directory | 12 | GitHub directory listing on integration branch |
| Applied migrations without matching source file | 5 | Exact paths tested on main, integration and W10 branch |
| Public base tables | 15 | Read-only database catalog query; not 17 |
| Additional public view | 1 | `public.public_profiles` |
| Public Storage buckets | 0 of 2 | Both buckets report `public=false` |
| Deployed QA Edge Functions | 1 | `qa-messenger-abc` v5 |
| QA AuthZ function deployed | No | `qa-authz-two-user` absent |
| Historical Staging A/B/C Messenger suite | 11/11 | Run #133, but through legacy PR OIDC path |
| Current exact-head W10/FB/Messenger CI | 3 successful runs | #169 / #156 / #157 |
| Product journeys accepted under strict X10 definition | **0** | No independent review + complete current runtime/security evidence |
| Gate A | **OPEN** | #60 |
| Release Ready | **NO** | No release authorization |

### 1.2 Most important open blockers

1. **Migration source drift:** 5 migration files in the applied Staging ledger are missing from the integration migration directory and were not found on main or W10 branch. Their source must be recovered from an authoritative backup/repository object, not recreated by guesswork.
2. **OIDC trust mismatch:** Staging's deployed `qa-messenger-abc` v5 still accepts the old `pull_request` / `ci.yml` identity. W10's reviewed source expects the protected `push` / `staging-authz.yml` identity. Deployed-source parity is unproven.
3. **Replay proof incomplete:** `token_hash` is a PRIMARY KEY and service-role-only table, but duplicate/concurrent/write-failure/cleanup runtime tests are not evidenced.
4. **Gate A incomplete:** a historical 11/11 Messenger A/B/C Staging suite exists, but it does not cover all Gate A requirements and was invoked through the legacy untrusted-PR OIDC path. Independent security review is absent.
5. **FB privacy unresolved:** `posts` has no persisted audience/visibility column; `posts`, `post_comments` and `post_reactions` have authenticated SELECT policies with `USING (true)`. Private post semantics cannot be claimed.
6. **Nested comment integrity unresolved:** the parent comment FK proves parent existence but not same-post parent/child integrity.
7. **Other product vertical slices:** no accepted Staging journey evidenced for W3–W9 or W11–W13. Locale/country row counts are registry data, not completed localization.
8. **Android:** build/bootstrap evidence exists, but generated native source and lockfile are not committed in PR #59 and physical-device/Auth deep-link acceptance is outstanding.

## 2. GitHub PR and CI register

### 2.1 All open PRs discovered

The open-PR search returned six PRs. Every listed PR remains Open, Draft and Not Merged at audit time.

| PR | Scope | Head branch | Exact head SHA | Latest run | Result | Changed paths / evidence |
|---|---|---|---|---|---|---|
| [#54](https://github.com/MYGRAM-DB/mygram-app/pull/54) | Foundation / integration baseline | `rebuild/phase-a-architecture` | `c797e293f23fbc337510a95e7a051b42f72bfef7` | [Run #133](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41192176699) | SUCCESS, 2 jobs | Foundation app, docs, CI, E2E, QA source, 12 migration files; see PR Files tab |
| [#59](https://github.com/MYGRAM-DB/mygram-app/pull/59) | Android Staging bootstrap | `feature/android-staging` | `f2edc7fcc28c971bad4914c80b7408998da84218` | [Run #9](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41185503288) | SUCCESS, 1 job | `.github/workflows/android-staging.yml`, `capacitor.config.json`, `vite.config.ts` |
| [#87](https://github.com/MYGRAM-DB/mygram-app/pull/87) | GLOBAL 90 execution-order documentation | `docs/global-90-execution-order` | `d5db6fd181d67609cd657ed532e257e4668b711e` | No PR run returned for exact head | Not evidenced | `docs/MYGRAM-GLOBAL-90-EXECUTION-ORDER.md` |
| [#90](https://github.com/MYGRAM-DB/mygram-app/pull/90) | W10 contracts / CI / protected workflow | `feature/workshop-platform-contracts` | `1a8b2763f9f3f061c3dfb4f7160810609f8354f1` | [Run #169](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41199790121) | SUCCESS, 1 job | CI, protected workflow, ownership, contracts, OIDC policy, QA source, tests |
| [#91](https://github.com/MYGRAM-DB/mygram-app/pull/91) | W1 FB nested replies / owner edit | `feature/workshop-fb` | `d5a2f6c657986c51a232ef1b5826cb7b3d4265d9` | [Run #156](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41197385536) | SUCCESS, 1 job | `SocialFeedWorkspace.tsx`, FB helper/tests, #95 proposal, duplicated `ci.yml` |
| [#92](https://github.com/MYGRAM-DB/mygram-app/pull/92) | W2 Messenger pagination / attachment recovery | `feature/workshop-messenger` | `02a83a6dba6d7d5299bd4043b516db40060f3c7b` | [Run #157](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41197405337) | SUCCESS, 1 job | `MessengerWorkspace.tsx`, Messenger helper/types/tests, duplicated `ci.yml` |

PR pages and file lists:
- [PR #54 files](https://github.com/MYGRAM-DB/mygram-app/pull/54/files)
- [PR #59 files](https://github.com/MYGRAM-DB/mygram-app/pull/59/files)
- [PR #87 files](https://github.com/MYGRAM-DB/mygram-app/pull/87/files)
- [PR #90 files](https://github.com/MYGRAM-DB/mygram-app/pull/90/files)
- [PR #91 files](https://github.com/MYGRAM-DB/mygram-app/pull/91/files)
- [PR #92 files](https://github.com/MYGRAM-DB/mygram-app/pull/92/files)

### 2.2 Exact CI jobs and what they prove

| Run | Tested SHA | Job(s) | Observed result | What it proves | What it does not prove |
|---|---|---|---|---|---|
| #133 / 41192176699 | `c797e293f23fbc337510a95e7a051b42f72bfef7` | `Typecheck, unit tests, Playwright, and production build`; `Real JWT, Profile Privacy, Storage, Messenger A/B/C, and Realtime` | Both SUCCESS | Foundation tests/build plus historical live Staging Messenger A/B/C suite | Current approved OIDC trust, deployed source parity, full Gate A, product-specific FB/Messenger UI E2E |
| #9 / 41185503288 | `f2edc7fcc28c971bad4914c80b7408998da84218` | `android-bootstrap` | SUCCESS | Android staging bootstrap/build lane | Physical-device acceptance, PKCE cold/warm callbacks, committed generated Android source |
| #169 / 41199790121 | `1a8b2763f9f3f061c3dfb4f7160810609f8354f1` | `Unit tests, Playwright, and production build` | SUCCESS | Unit/contract tests, 7 baseline browser E2E tests, integration-source syntax checks, Deno typechecks for both QA sources, TypeScript and production build | Live OIDC, Edge Function deployment/parity, Staging runtime, A/B/C authorization |
| #156 / 41197385536 | `d5a2f6c657986c51a232ef1b5826cb7b3d4265d9` | `Unit tests, Playwright, and production build` | SUCCESS | PR source checks and configured browser/build suite | FB privacy acceptance, same-post FK, real A/B/C UI/REST denial |
| #157 / 41197405337 | `02a83a6dba6d7d5299bd4043b516db40060f3c7b` | `Unit tests, Playwright, and production build` | SUCCESS | PR source checks and configured browser/build suite | Messenger real network reconnect, pagination, attachment A/B/C, signed URL expiry |
| — | `d5db6fd181d67609cd657ed532e257e4668b711e` | No run returned | Not evidenced | Documentation branch/file exists | CI or review |

Run timestamps and URLs:
- Run #133: 2026-10-31 10:17:59Z to 10:19:05Z.
- Run #9: 2026-10-31 08:39:39Z to 08:41:41Z.
- Run #156: 2026-10-31 11:34:03Z to 11:34:49Z.
- Run #157: 2026-10-31 11:34:20Z to 11:35:03Z.
- Run #169: 2026-10-31 12:08:43Z to 12:09:43Z.

The three current workshop PR runs #169/#156/#157 each reported one successful combined job. Their success must not be described as separate proof of every product test type unless the job steps and test outputs explicitly show that test.

### 2.3 CI ownership and OIDC transition

At integration base SHA `c797e293f23fbc337510a95e7a051b42f72bfef7`, `.github/workflows/ci.yml` contains a `staging-authz` job under the `pull_request` workflow and grants `id-token: write`. Run #133 confirms that this job actually called `qa-messenger-abc`.

W10 PR #90 changes the design:
- PR CI job has read-only repository permissions and no OIDC invocation.
- Separate `.github/workflows/staging-authz.yml` triggers on push to `rebuild/phase-a-architecture`.
- QA workflow is gated by `vars.MYGRAM_STAGING_QA_ENABLED == 'true'`.
- A fresh OIDC token is requested for each function endpoint.
- Shared policy checks issuer, audience, expiry, not-before, token ID, repository and owner IDs, event, ref, workflow path/name, subject, commit SHA, workflow SHA and run identity.

**Transition state:** the safe W10 workflow is still on PR #90, not integrated. PR #91 and #92 still include duplicate `.github/workflows/ci.yml` changes. Do not remove those files from product PRs until the W10 replacement has passed independent review, owner approval and is present on integration. No merge or deployment is authorized by this report.

## 3. Supabase Staging audit

### 3.1 Project and inventory

Read-only project inspection:
- Project: `MYGRAM-STAGING`
- Ref: `cbyvtehvaojxfcgpelir`
- Status: `ACTIVE_HEALTHY`
- Region: `eu-west-1`
- PostgreSQL: 17.11.0.003 / engine 17

**Correct inventory:**
- Applied migration ledger: **17**
- Public base tables: **15**
- Public view: **1** (`public_profiles`)
- Public RLS policies: **32**
- Storage buckets: **2**
- Public Storage buckets: **0**

The earlier report's “17 public tables” was an incorrect carry-over of the migration count. The live catalog query returned 15 base tables. The 15 tables are:
1. `profiles`
2. `user_preferences`
3. `posts`
4. `post_comments`
5. `post_reactions`
6. `supported_locales`
7. `profile_private_details`
8. `supported_countries`
9. `messenger_conversations`
10. `messenger_participants`
11. `messenger_messages`
12. `messenger_attachments`
13. `qa_run_challenges`
14. `ui_translation_cache`
15. `ui_translation_daily_usage`

Notable observed row counts: `profiles` 3, `supported_locales` 60, `supported_countries` 205, `qa_run_challenges` 2. Other inspected feature tables returned zero rows at audit time. Counts are a snapshot, not a functionality claim.

### 3.2 Applied migrations versus source files

Staging migration ledger contains these 17 versions:

| Version | Ledger name | Source file on integration? | Result |
|---|---|---|---|
| 20261029200719 | create_profile_for_new_auth_users | No | Missing |
| 20261029200728 | revoke_public_execute_handle_new_user | No | Missing |
| 20261029211249 | mygram_staging_profiles_rls_core | No | Missing |
| 20261029223828 | create_supported_locales_public_read | No | Missing |
| 20261030022611 | align_staging_core_schema_phase_1 | Yes | Found |
| 20261030023659 | create_private_profile_details_and_stage_countries | Yes | Found |
| 20261030024521 | add_secure_profile_completion_rpc | Yes | Found |
| 20261030030822 | profile_avatars_storage_security | Yes | Found |
| 20261030165820 | create_messenger_direct_conversations_security | Yes | Found |
| 20261030170124 | add_messenger_foreign_key_indexes | Yes | Found |
| 20261030171814 | secure_public_profile_projection | Yes | Found |
| 20261030193759 | harden_public_profile_views_and_private_state | Yes | Found |
| 20261030194646 | enable_messenger_postgres_changes | No | Missing |
| 20261030195358 | create_one_time_qa_runner_challenges | Yes | Found |
| 20261030195558 | expand_supported_locales_to_sixty | Yes | Found |
| 20261030201257 | create_cached_ui_translation_service | Yes | Found |
| 20261030212710 | restore_messenger_private_broadcast_triggers | Yes | Found |

The five missing source files were tested at the expected path under:
- `main`
- `rebuild/phase-a-architecture`
- `feature/workshop-platform-contracts`

All 15 path/ref checks returned NOT_FOUND for the five files. The integration directory listing contains 12 SQL files, matching the 12 found versions above. This is a source-provenance gap, not permission to reconstruct SQL from the current schema.

**Required action:** Database/W10 must locate authoritative migration artifacts from a verified backup, prior commit/object, or Supabase migration archive. Record source SHA, origin, and checksum. Until then:
- Do not rewrite the migration ledger.
- Do not recreate missing files from memory or current schema.
- Do not apply a “repair” migration.
- Do not claim complete source parity for the 17 applied migrations.

Found source file blob SHAs:
- `20261030022611_align_staging_core_schema_phase_1.sql`: `de7a207917a9146f47aa8e60fd799177b1ec92eb`
- `20261030023659_create_private_profile_details_and_stage_countries.sql`: `8c03e574dbb0db3d9eef6528fc7723e412b29c77`
- `20261030024521_add_secure_profile_completion_rpc.sql`: `4dc5c1e34e42126a52f5b430ad8392b2ad6bdbd7`
- `20261030030822_profile_avatars_storage_security.sql`: `7e450028590f7a151c00ecddf240a6999531e651`
- `20261030165820_create_messenger_direct_conversations_security.sql`: `598d39124e1c235256766deb26315cf9f1d0c851`
- `20261030170124_add_messenger_foreign_key_indexes.sql`: `d981e579654f732f6b19492f014880c9bdb96eb9`
- `20261030171814_secure_public_profile_projection.sql`: `ccd3cf87e0af95313b8dafa8abcd1f75ac5745f2`
- `20261030193759_harden_public_profile_views_and_private_state.sql`: `c29f776b76dbe103b2213342f83e4c020ae38bf4`
- `20261030195358_create_one_time_qa_runner_challenges.sql`: `2b6926485bfba72ac43118416b7ecf847acb8661`
- `20261030195558_expand_supported_locales_to_sixty.sql`: `4b65414f2751f991cf4db069cfcf478078d2fdba`
- `20261030201257_create_cached_ui_translation_service.sql`: `41ab7cbd718547f2c4290b4f4bb42854ca849745`
- `20261030212710_restore_messenger_private_broadcast_triggers.sql`: `2291cbf6704d32c294472157058d60c00ed1bba2`

### 3.3 Current schema, policies and privacy findings

All 15 inspected public base tables report RLS enabled. That fact alone does not prove the policies implement the required privacy semantics.

Live policy query findings:
- `posts_select_authenticated`: authenticated SELECT, permissive, `USING (true)`.
- `post_comments_select_authenticated`: authenticated SELECT, permissive, `USING (true)`.
- `post_reactions_select_authenticated`: authenticated SELECT, permissive, `USING (true)`.
- `posts_update_self`: update constrained to `auth.uid() = user_id`.
- `post_comments_update_self` and owner insert/delete predicates are user-bound, but visibility inheritance is not enforced by the permissive SELECT policies.
- `profiles_select_public_projection` is authenticated SELECT with `USING (true)`, paired with column grants for the public projection. Private details are in a separate owner-protected table.
- Messenger conversation/message/participant policies check the authenticated user against the two conversation participants; message inserts constrain sender to `auth.uid()`.
- `messenger_attachments` metadata insert is constrained to uploader identity and participant membership.

**FB audience gap:** `posts` has none of `visibility`, `audience`, or `privacy` columns. There is no persisted Public/Private selector state. Under Decision 15, Public means all authenticated MYGRAM users; Private means owner-only; new posts default Private; comments/replies/reactions/counts/Realtime inherit parent post visibility. The present `USING (true)` policies do not implement those semantics.

**Nested comments gap:** `post_comments.parent_comment_id` has a single-column FK to `post_comments.id` with cascade. It does not enforce that parent and child have the same `post_id`. Issue #95 contains the proposal direction; no composite FK migration is applied.

### 3.4 Storage

Two buckets were returned by the live catalog:
- `profile-avatars`: `public=false`
- `messenger-attachments`: `public=false`

No public bucket was found. Storage policies constrain profile avatars to the owner's folder; Messenger attachment object access is constrained by conversation membership and uploader folder for write/update/delete. This is policy-source evidence only. It does not replace runtime A/B/C signed URL expiry/renewal/denial tests.

### 3.5 Security and performance advisors

Security Advisor snapshot (observed 2026-10-31 13:40:54.553Z):
- INFO `rls_enabled_no_policy`: 3 findings on `qa_run_challenges`, `ui_translation_cache`, `ui_translation_daily_usage`. The inspected migrations revoke client roles and grant table operations to `service_role`; this appears intentional service-only design, but must remain checked against grants and no API-client access.
- WARN `authenticated_security_definer_function_executable`: `public.complete_mygram_profile(...)` is SECURITY DEFINER and executable by `authenticated`. The RPC is intended for onboarding and derives identity server-side; Security must independently review its full function body and runtime authorization.
- WARN `auth_leaked_password_protection`: leaked-password protection is disabled. Earlier project-plan restrictions prevented enabling it; retain as a documented risk until plan/settings allow remediation.

Performance Advisor snapshot (observed 2026-10-31 13:40:55.641Z):
- INFO `posts_created_at_idx` unused.
- INFO `post_comments_parent_comment_id_idx` unused.
No index was removed. Do not remove an index without workload analysis and approval.

Function privilege query:
- `complete_mygram_profile(...)`: SECURITY DEFINER; executable by authenticated.
- `get_my_profile_state()`: SECURITY INVOKER; executable by authenticated.
- `reserve_mygram_translation_quota(integer)`: SECURITY DEFINER; not executable by authenticated (service-role only).

## 4. Security, OIDC, Replay and Gate A

### 4.1 Deployed Edge Functions

Staging Edge Function inventory:
| Function | State | Version | verify_jwt | Bundle digest | Source parity |
|---|---|---:|---|---|---|
| `qa-messenger-abc` | ACTIVE | 5 | false | `0868b0afefd8cd5969185c4f9f350373640c83c3a76edfad508932c17acbc6a7` | Not proven |
| `qa-authz-two-user` | Not deployed | — | — | — | Not applicable |

The deployed Messenger QA source currently validates an OIDC token but still trusts the legacy identity:
- event `pull_request`
- workflow path prefix `.github/workflows/ci.yml@`
- workflow name `MYGRAM Build and Quality Gate`
- subject ending in `pull_request`
- integration head/base references from the older CI route

W10 PR #90 source instead imports the shared strict allowlist for:
- `push`
- `refs/heads/rebuild/phase-a-architecture`
- `.github/workflows/staging-authz.yml`
- immutable repository/owner identity and subject
- audience, issuer, expiry, `iat`, `nbf`, `jti`, commit SHA, workflow SHA and run identity

The deployed function version/digest is not a Git SHA. No trusted provider attestation or independent reproducible source-to-bundle mapping has been supplied. Do not equate the digest with a source commit.

### 4.2 Replay protection

Live Staging table:
- `qa_run_challenges` exists.
- `token_hash` is the PRIMARY KEY.
- RLS and FORCE RLS are enabled.
- Client roles have no table privileges; service_role has SELECT/INSERT/UPDATE/DELETE.
- 2 rows were present at audit time.

Code review of the currently deployed function:
- Hashes the OIDC token with SHA-256 and inserts the hash.
- Duplicate insert errors return HTTP 409, so the primary key is a database-level duplicate barrier.
- It attempts to delete expired challenges before inserting the new one.
- The deletion error is not checked before continuing.
- Expired records are pruned only when the QA function is invoked; no independent scheduled retention/monitoring proof was found.

Not yet proven:
- Two concurrent requests with the same token result in exactly one successful claim.
- Database write failure fails closed under real runtime conditions.
- Cleanup deletion failure is surfaced and does not silently proceed.
- Expired-row retention is bounded when the QA function is not invoked.
- Replay behavior is verified under concurrency, not inferred from the primary key.

### 4.3 Historical Staging runtime evidence

Run [#133](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41192176699), tested SHA `c797e293f23fbc337510a95e7a051b42f72bfef7`, ran 2026-10-31 10:18:45Z–10:19:03Z.

The second job `Real JWT, Profile Privacy, Storage, Messenger A/B/C, and Realtime` called the deployed `qa-messenger-abc` function and returned:
- `ok=true`
- 11 checks total
- 11 PASS
- 0 FAIL
- `cleanup_complete=true`

Passed checks reported:
1. Three independent real JWT sessions A/B/C.
2. Profile-state RPC and safe public projection.
3. Profile avatar Storage isolation (A allowed, C denied).
4. A creates direct conversation with B.
5. Private Realtime: A/B subscribed, C denied.
6. A sends and B receives private Realtime broadcast.
7. REST membership isolation.
8. Sender spoof and unauthorized participant addition denied.
9. Private attachment metadata and Storage isolation (A/B allowed as members, C denied).
10. Unauthorized conversation creation denied.
11. Cleanup reported complete.

**Important qualification:** Run #133 used the old `pull_request` CI OIDC job and old deployed function trust policy. It is valid historical Staging behavior evidence for the checks it executed, but it is not proof that the new protected Workflow/OIDC design is live or approved. The suite did not test all Gate A requirements: invitation lifecycle, membership expiry/revocation, expired/revoked Auth sessions, signed URL expiry/renewal, replay concurrency, or all cleanup resource absence checks.

The currently retrieved deployed source's final cleanup predicate explicitly verifies the conversation row and attachment metadata count, but does not independently query that all Auth users and Storage objects are absent. The response text from Run #133 says the ephemeral users and objects were removed; source inspection does not establish independent absence verification for those resources. Therefore cleanup is **partially evidenced**, not accepted as a full cleanup proof.

### 4.4 Gate A status

[Issue #60](https://github.com/MYGRAM-DB/mygram-app/issues/60) remains OPEN / P0. [Membership #55](https://github.com/MYGRAM-DB/mygram-app/issues/55) remains OPEN / P1.

Still required:
- QA-only server-side fixture seeding; never seed protected fixtures using user JWTs.
- Independent A/B/C JWT requests for each authorization assertion.
- Membership/invite: invited, non-invited, expired, revoked, capacity and session continuity.
- REST and Realtime membership enforcement, including non-member with valid Auth session.
- Private Storage object and signed URL access, expiry, renewal and denial.
- Auth session expiry, refresh, revocation and token invalidation.
- Replay duplicate, concurrency, write-failure and retention tests.
- Cleanup absence queries for Auth users, database rows, Storage objects and Realtime channels; all query errors fail closed.
- Independent human security review with reviewer identity and evidence.
- Safe trusted OIDC workflow installed on integration and independently source-matched to deployed functions before any activation.

Gate A remains OPEN. No QA function deployment or QA invocation occurred during this report-preparation audit.

## 5. Workshop-by-workshop delivery report

### W1 — MYGRAM FB

**Status: `partial`**  
**Owner:** W1 FB. **Independent reviewer:** not recorded.  
**PR:** [#91](https://github.com/MYGRAM-DB/mygram-app/pull/91), Open/Draft/Not Merged.  
**SHA:** `d5a2f6c657986c51a232ef1b5826cb7b3d4265d9`.  
**CI:** [Run #156 SUCCESS](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41197385536).

Changed paths:
- `src/components/SocialFeedWorkspace.tsx`
- `src/lib/workshops/fb.mjs`
- `tests/workshops/fb.test.mjs`
- `docs/proposals/ISSUE-95-SAME-POST-COMMENT-INTEGRITY.md`
- `.github/workflows/ci.yml` (temporary duplicate pending W10 transition)

Source evidence:
- React workspace reads `posts`, `post_comments`, `post_reactions`, and `public_profiles` from Supabase.
- Comment model includes `parent_comment_id`; UI builds parent/child comment trees.
- Owner edit flow updates `posts.content` with both post ID and owner ID and fails closed if no row returns.
- Pure helper tests cover reply insertion and owner-only edit rules.

Database blockers:
- No `posts.visibility`, `audience`, or `privacy` column.
- `posts_select_authenticated`, `post_comments_select_authenticated`, `post_reactions_select_authenticated` are permissive `USING (true)`.
- Parent FK is only `parent_comment_id -> post_comments.id`; it does not enforce same `post_id`.

Open blockers:
- [#93 P0](https://github.com/MYGRAM-DB/mygram-app/issues/93): audience/visibility model and policy design.
- [#95 P1](https://github.com/MYGRAM-DB/mygram-app/issues/95): same-post parent relationship.

Not proven:
- Authenticated browser journey for create/edit/comment/reply/reload against Staging.
- A can edit own post while B/C are denied via UI and direct REST.
- Private post default and visibility inheritance for comments/reactions/counts/Realtime.
- Cross-post parent reference is rejected by the database.
- Error/retry/delete and mobile RTL E2E.

Next: DB/Security prepare reviewed audience and composite-FK proposals with preflight, post-migration matrix, A/B/C allow/deny tests and rollback. No migration is authorized by this report.

### W2 — MYGRAM Messenger

**Status: `partial`**  
**Owner:** W2 Messenger. **Independent reviewer:** not recorded.  
**PR:** [#92](https://github.com/MYGRAM-DB/mygram-app/pull/92), Open/Draft/Not Merged.  
**SHA:** `02a83a6dba6d7d5299bd4043b516db40060f3c7b`.  
**CI:** [Run #157 SUCCESS](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41197405337).

Changed paths:
- `src/components/MessengerWorkspace.tsx`
- `src/lib/workshops/messenger.mjs`
- `src/lib/workshops/messenger.d.mts`
- `tests/workshops/messenger.test.mjs`
- `.github/workflows/ci.yml` (temporary duplicate pending W10 transition)

Source evidence:
- Workspace reads conversations/messages/attachments from Supabase.
- Keyset pagination uses `created_at` and `id`, not an assumed sequence column.
- Merge helper deduplicates by ID and sorts deterministically, including equal timestamps.
- Attachment helper has queued/uploading/uploaded/failed transitions.
- Source changes address stale conversation loads, older-page preservation and signed URL regeneration.

Historical Staging evidence: Run #133 passed 11/11 Messenger A/B/C real-JWT checks, including conversation membership, REST isolation, Realtime delivery, sender spoof denial and private attachment isolation. This run is not a current approved OIDC acceptance because it used the legacy PR workflow; see Section 4.3.

Not proven:
- Product-specific browser E2E for rapid conversation switching and pagination.
- Realtime reconnect under actual network interruption while preserving older pages.
- Attachment failure cleanup and retry under induced failures.
- Signed URL expiry, renewal and denial after revocation.
- Session expiry/revocation and invitation/membership lifecycle.
- Full independent cleanup absence verification.

Next: run a dedicated Staging journey only after safe QA workflow/source parity approval; add failure injection and signed-link expiry tests. Keep private buckets.

### W3 — WHATSMYGRAM

**Status: `partial` (identity primitives only; product journey not accepted)**  
**Issue:** [#75](https://github.com/MYGRAM-DB/mygram-app/issues/75), OPEN.  
**Branch planned:** `feature/workshop-whatsmygram`. No dedicated open product PR found in the open-PR inventory.

Existing schema primitives include country calling codes, private profile contact fields and user preferences. These are not proof of a separate phone/contact product.

Required: phone normalization and E.164 validation; distinguish entered from verified number; consent-based contact discovery; anti-enumeration/rate limiting; invite/connection lifecycle; privacy/opt-out; country/number UX. SMS provider, real OTP and address-book upload remain disabled pending explicit approval and consent.

Missing evidence: real UI/API journey, server-side contact identity, provider delivery, A/B/C contact visibility, anti-enumeration tests, browser E2E, retry and cleanup. No OTP/SMS activation.

### W4 — MYGRAM Insta

**Status: `design-verified`**  
**Issue:** [#76](https://github.com/MYGRAM-DB/mygram-app/issues/76), OPEN.  
**Branch planned:** `feature/workshop-insta`. No dedicated open PR found.

Required: image post create/edit/delete, captions/tags/alt text, feed/discovery, stories with server-enforced expiry and view rules, follow graph, reactions/comments where approved, report/block and mobile RTL/LTR.

No Insta-specific schema/workspace or accepted persisted media journey was established by this audit. Private Storage, viewer/owner authorization, signed access expiry, retry/delete and A/B/C denial remain required. No public bucket.

### W5 — MYGRAM Twitty

**Status: `design-verified`**  
**Issue:** [#77](https://github.com/MYGRAM-DB/mygram-app/issues/77), OPEN.  
**Branch planned:** `feature/workshop-twitty`. No dedicated open PR found.

Required: short posts, edit/delete, replies/threads, repost/quote, hashtags/mentions, deterministic feed ordering/pagination, follow graph, notifications/deep links, block/mute/report, rate limits and privacy-aware search.

No Twitty-specific persisted workspace or Staging journey established. Need A/B/C visibility and denial, abuse/report, stable ordering, browser E2E and mobile RTL tests.

### W6 — MYGRAM Meeting

**Status: `design-verified`**  
**Issue:** [#78](https://github.com/MYGRAM-DB/mygram-app/issues/78), OPEN.  
**Branch planned:** `feature/workshop-meeting`. No dedicated open PR found.

No Meeting tables were present in the inspected public schema. Required: create/schedule/join/leave, invitations, waiting room, host/participant controls, chair transfer, mute/remove, reconnect and short-lived media tokens.

No SFU/provider approval, capacity evidence or physical-device load evidence. Do not claim live audio/video or 30 participants. Recording off unless consented; no paid provider activation.

### W7 — MYGRAM Tube

**Status: `design-verified`**  
**Issue:** [#79](https://github.com/MYGRAM-DB/mygram-app/issues/79), OPEN.  
**Branch planned:** `feature/workshop-tube`. No dedicated open PR found.

No video-processing queue/channel schema was present in the inspected public schema. Required: channel, video upload, metadata, privacy/publish lifecycle, resumable upload, validation, processing/transcoding, adaptive playback, thumbnails, captions, playlists, moderation, deletion and retention.

No accepted upload-to-playback Staging journey. No CDN/transcoder claim or paid provider activation.

### W8 — MYGRAM TikToks

**Status: `design-verified`**  
**Issue:** [#80](https://github.com/MYGRAM-DB/mygram-app/issues/80), OPEN.  
**Branch planned:** `feature/workshop-tiktoks`. No dedicated open PR found.

Required: capture/select, consent, resumable upload, validation, shared media/transcode/thumb pipeline, vertical feed, playback controls, low bandwidth, creator pages, moderation/report/block, measurable feed ordering.

No accepted stored/processed/played clip journey, A/B/C media visibility, performance, accessibility or physical mobile evidence. Must share the reviewed media contract with Insta/Tube.

### W9 — MYGRAM AI

**Status: `design-verified`**  
**Issue:** [#81](https://github.com/MYGRAM-DB/mygram-app/issues/81), OPEN.  
**Branch planned:** `feature/workshop-ai`. No dedicated open PR found.

No AI quota/history tables were present in the inspected public schema. A translation quota function exists, but it is not a general AI product.

Required: server-side provider adapter, server-verified identity, private per-user history, delete/retention, quotas, rate limits, cost metering, budget alarms, timeout/retry and cross-user denial. No paid AI provider or client secret without explicit approval.

### W10 — Platform and Shared Contracts

**Status: `partial`**  
**Issue:** [#82](https://github.com/MYGRAM-DB/mygram-app/issues/82), OPEN.  
**PR:** [#90](https://github.com/MYGRAM-DB/mygram-app/pull/90), Open/Draft/Not Merged.  
**SHA:** `1a8b2763f9f3f061c3dfb4f7160810609f8354f1`.  
**CI:** [Run #169 SUCCESS](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41199790121).

Changed paths:
- `.github/workflows/ci.yml`
- `.github/workflows/staging-authz.yml`
- `docs/WORKSHOP-OWNERSHIP.md`
- `src/contracts/database.ts`
- `src/lib/workshops/contracts.mjs`
- `supabase/functions/_shared/github-oidc-policy.d.mts`
- `supabase/functions/_shared/github-oidc-policy.mjs`
- `supabase/functions/qa-authz-two-user/index.ts`
- `supabase/functions/qa-messenger-abc/index.ts`
- `tests/github-oidc-policy.test.mjs`
- `tests/workshops/contracts.test.mjs`

Run #169 passed the single combined job, including unit/contract tests, 7 baseline Playwright E2E tests, integration-source syntax checks, Deno typechecks for both QA function sources, TypeScript and production build.

Still open:
- independent security review and owner approval for CI transition;
- integration branch still contains the old PR-triggered OIDC job;
- deployed `qa-messenger-abc` remains legacy v5;
- `qa-authz-two-user` not deployed;
- source-to-deployed-function provenance absent;
- replay runtime tests absent;
- migration source inventory has five gaps;
- shared product contracts do not imply implementation of the products.

W10 must remain sole owner of central CI and shared contracts. No merge/deploy/migration is authorized.

### W11 — Localization and Countries

**Status: `partial` (registry data only)**  
**Issue:** [#83](https://github.com/MYGRAM-DB/mygram-app/issues/83), OPEN.  
**Branch planned:** `feature/workshop-localization`. No dedicated open PR found.

Live Staging confirms:
- 60 rows in `supported_locales`.
- 205 rows in `supported_countries`.
- Locale and country registry fields include RTL metadata and calling codes.
- `ui_translation_cache` and `ui_translation_daily_usage` exist; translation cache and daily usage are service-role-only.

Not proven:
- 60 complete translated UIs.
- key parity, missing keys, placeholders, plurals, fallback and mixed-language leakage.
- RTL/LTR coverage in active screens.
- E.164 validation and phone-country behavior.
- distinction between nationality, residence, phone country, locale and time zone through a real onboarding journey.

Registry counts are not translation acceptance. No silent machine translation should be shipped as approved copy.

### W12 — Marketplace and Ads

**Status: `design-verified`**  
**Issue:** [#84](https://github.com/MYGRAM-DB/mygram-app/issues/84), OPEN.  
**Branch planned:** `feature/workshop-marketplace-ads`. No dedicated open PR found.

No Marketplace listing, campaign, ad inventory or inquiry tables were present in the inspected public schema. Required: seller/store, listing lifecycle, categories/attributes, search/filter, privacy-aware location, buyer inquiry through Messenger, moderation/report/fraud controls and labelled sponsored inventory with budget/frequency caps and measurement.

No private-message targeting, sensitive-data targeting, Wallet, Payments, escrow, cards, paid ads or paid campaign activation.

### W13 — Admin and OPS

**Status: `design-verified`**  
**Issue:** [#85](https://github.com/MYGRAM-DB/mygram-app/issues/85), OPEN.  
**Branch planned:** `feature/workshop-admin-ops`. No dedicated open PR found.

No dedicated audit-event, moderation, incident or admin-role tables were present in the inspected public schema. Required: least-privilege admin roles, server-side enforcement, moderation/report/appeals, account restriction/revocation, redacted audit logs, correlation IDs, alerts, quotas/feature flags, backup/restore design, Staging restore drill, performance baselines and incident/rollback runbooks.

No Production mutation, no service-role browser exposure. Staging restore and alert exercise remain unproven.

### Android

**Status: `partial`**  
**PR:** [#59](https://github.com/MYGRAM-DB/mygram-app/pull/59), Open/Draft/Not Merged.  
**SHA:** `f2edc7fcc28c971bad4914c80b7408998da84218`.  
**CI:** [Run #9 SUCCESS](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41185503288), job `android-bootstrap`.

Changed source paths:
- `.github/workflows/android-staging.yml`
- `capacitor.config.json`
- `vite.config.ts`

PR description records a generated Android build and `assembleDebug` on the ephemeral runner, package `com.mygram.app.staging`, target SDK 36, debug signer and APK SHA. The APK was discarded and not distributed. Generated native source and exact package lock are available as artifact ID `13036279372`, with artifact SHA-256 `2b40287e7769834b2714623368c723d0c53624b21713a28aa400a321ba2cc75c`, until 2026-11-07 according to the PR record.

Not yet accepted:
- commit generated `android/` source and package lock to reviewed source branch;
- clean reproducible build from committed source;
- email confirmation/recovery PKCE callback on cold and warm app starts;
- physical-device Auth/profile/RTL/keyboard/back-navigation/FB/Messenger tests;
- independent security review and owner release approval.

No APK distribution or tester rollout.

## 6. Issue and blocker register

| Issue | Severity | State | Owner | Closure evidence |
|---|---|---|---|---|
| [#55 Preview membership](https://github.com/MYGRAM-DB/mygram-app/issues/55) | P1 | OPEN | Security + Database + W10 | Invite/non-invite/expiry/revoke/capacity and A/B/C tests; private membership schema and rollback |
| [#60 Gate A](https://github.com/MYGRAM-DB/mygram-app/issues/60) | P0 | OPEN | Security | Complete independent A/B/C Auth/REST/Realtime/Storage/session/replay/cleanup suite and human review |
| [#73 W1 FB](https://github.com/MYGRAM-DB/mygram-app/issues/73) | P1 | OPEN | W1 | Persisted post/comment/reply/edit journey, Decision 15 semantics, A/B/C and E2E |
| [#74 W2 Messenger](https://github.com/MYGRAM-DB/mygram-app/issues/74) | P1 | OPEN | W2 | Persisted conversation/message/attachment journey, participant/revocation tests, pagination/reconnect |
| [#75–#81 W3–W9](https://github.com/MYGRAM-DB/mygram-app/issues/75) | P1/P2 by scope | OPEN | Each product owner | Real vertical slice and scoped authorization/E2E evidence |
| [#82 W10](https://github.com/MYGRAM-DB/mygram-app/issues/82) | P1 | OPEN | W10 | Shared contracts, ownership, canonical CI and approved transition |
| [#83 W11](https://github.com/MYGRAM-DB/mygram-app/issues/83) | P1 | OPEN | W11 | Translation parity and active-screen RTL/LTR E2E |
| [#84 W12](https://github.com/MYGRAM-DB/mygram-app/issues/84) | P2 | OPEN | W12 | Persisted listing/inquiry and controlled labelled ad tests |
| [#85 W13](https://github.com/MYGRAM-DB/mygram-app/issues/85) | P1 | OPEN | W13 | Least-privilege admin, audit, alert exercise and Staging restore |
| [#88 Product integration](https://github.com/MYGRAM-DB/mygram-app/issues/88) | P1 | OPEN | W10 + W1–W13 | Real UI → API → persistence → authorization → browser-tested journeys |
| [#89 Central CI](https://github.com/MYGRAM-DB/mygram-app/issues/89) | P1 | OPEN | W10 | Canonical CI, exact SHA, Playwright and separate trusted security lane |
| [#93 FB audience/privacy](https://github.com/MYGRAM-DB/mygram-app/issues/93) | P0 | OPEN | DB + Security + W1 | Reviewed audience schema/policies, preflight, rollback, A/B allow/deny |
| [#94 X10 ledger](https://github.com/MYGRAM-DB/mygram-app/issues/94) | P1 | OPEN | W10 | This report, reconciled evidence and reviewer sign-offs |
| [#95 Comment integrity](https://github.com/MYGRAM-DB/mygram-app/issues/95) | P1 | OPEN | DB + Security + W1 | Same-post composite FK, preflight, rollback, REST negative tests |

No issue above is marked closed by this report.

## 7. Closure plan and dependencies

### Lane A — W10 / Security / CI
1. Recover the five missing migration files from an authoritative source and record provenance/checksums.
2. Independently review W10 OIDC claims and workflow boundaries.
3. Establish per-function deployed-source provenance: function name, deployed version, immutable package/source digest, provenance of digest, source commit and independent comparison.
4. Review replay logic; check cleanup-delete errors; add duplicate/concurrent exactly-one-success/write-failure/retention tests in an approved isolated test path.
5. Obtain explicit owner approval for the limited CI transition.
6. Only after safe CI is on integration, update #91/#92 and remove duplicate CI paths; rerun full CI on new exact SHAs.

### Lane B — Database / Security / FB
1. Reconcile migration sources before any schema design is applied.
2. Agree the exact Decision 15 audience representation and policy semantics.
3. Design a policy set that removes the current broad authenticated SELECT paths without adding permissive policies that OR with them.
4. Prepare #93 preflight, migration, post-schema matrix, A/B tests and rollback.
5. Prepare #95 composite unique/FK design and same-post negative tests.
6. No migration until independent review and explicit approval.

### Lane C — Gate A / membership
1. Define private invite/membership storage and server-only fixture provisioning.
2. Use independent A/B/C JWTs for all authorization assertions.
3. Cover session expiry/revocation, member/nonmember, invited/non-invited, expired/revoked membership, REST, Realtime, Storage and signed URL lifecycle.
4. Verify cleanup for Auth users, rows, objects and channels with fail-closed absence checks.
5. Independent human review; Gate A remains open until all conditions pass.

### Lane D — W1 / W2 product E2E
- W1: root comment, nested reply, reload, owner edit, other-user denial, public/private inheritance, REST denial, same-post FK.
- W2: two-user conversation persistence, pagination, rapid switching, Realtime reconnect, equal timestamps, upload failure/retry/cleanup, attachment A/B/C, signed URL expiry/renewal and membership revocation.

These product lanes can prepare code and tests in parallel, but schema/RLS and shared workflow changes remain serialized under their owners.

### Lane E — W3–W9 / W11–W13
Each workshop submits one vertical slice with:
- actual route/workspace;
- authenticated API/server adapter;
- persisted data where required;
- server-enforced authorization;
- Playwright browser journey;
- failure/retry/delete/cleanup;
- responsive RTL/LTR or mobile tests as applicable;
- exact branch, SHA, changed-file list, CI run/jobs;
- Staging evidence and A/B/C where applicable;
- independent reviewer and rollback.

No paid provider activation or new schema migration without separate review/approval.

### Lane F — Android
1. Preserve source artifact before expiry and review it.
2. Commit generated Android source and exact lockfile on isolated branch.
3. Rebuild cleanly and compare output reproducibility.
4. Test Auth callback/PKCE on cold and warm starts.
5. Test on physical device.
6. Wait for Gate A, independent security review and explicit owner approval before distribution.

## 8. Release-readiness decision

| Release gate | Current result | Reason |
|---|---|---|
| Source reviewed | Partial | Several PRs reviewed; migration source gaps remain |
| Unit tests | Passed on selected exact PR SHAs | Not equivalent to product acceptance |
| Build | Passed on selected exact PR SHAs | Not equivalent to runtime acceptance |
| Browser E2E | Baseline suite passed on selected runs | Product-specific E2E for every lane not proven |
| Staging runtime | Partial historical evidence | Run #133 11/11 for one Messenger/security slice, legacy OIDC route |
| A/B/C AuthZ | Partial historical evidence | Several Messenger/profile/storage checks passed; full Gate A incomplete |
| Independent security review | Not passed / not evidenced | No independent sign-off attached |
| Acceptance | None | 0 accepted journeys under strict X10 definition |
| Merge ready | No | Draft PRs and unresolved blockers |
| Release ready | **No** | Gate A open, privacy/migration/provenance blockers |
| Public launch / invites / APK | **Not authorized** | Explicitly prohibited until approvals |

**Final governance state:**
- Production READ-ONLY.
- Gate A OPEN.
- QA activation disabled pending source parity, independent review and explicit owner approval.
- No migration, RLS, Auth, Storage or Edge Function changes made during this audit.
- No merge, auto-merge, public release, invitations, APK distribution, paid provider activation, Wallet or Payments activation.

## 9. Review and sign-off register

| Review role | Required action | Status |
|---|---|---|
| W10 Platform | Verify report structure, exact SHAs, CI mapping and shared ownership | Pending |
| Security | Review OIDC, source provenance, replay, RLS, Auth, Storage, Realtime and A/B/C evidence | Pending |
| Database | Reconcile 17 migration ledger entries against 12 source files; review #93/#95 design and rollback | Pending |
| CI owner | Confirm job-level evidence and safe CI transition path | Pending |
| Workshop owners W1–W13 | Confirm scope, changed paths, outstanding work, owner and rollback | Pending |
| Project owner | Review report and explicitly authorize any future protected operation | Pending |

This report is an evidence-backed audit snapshot. Any later change must update the exact branch/SHA/run and the corresponding evidence row. Do not edit historical evidence to make a newer result appear to have existed earlier.
