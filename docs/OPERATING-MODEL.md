# MYGRAM | DECISION 12 ADDENDUM — Nine-product throughput and score control | 2026-10-31

> This addendum adds product delivery ownership and a reproducible score contract to Decision 11. It does not override security or release gates.

- [Run #121](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41181799872) is **SUCCESS** on exact SHA `b4adbd1fb2178f5711782c2a6748ff85e3e57c50`; both current jobs passed. The Staging suite invokes `qa-messenger-abc`, not `qa-authz-two-user`.
- [Issue #58](https://github.com/MYGRAM-DB/mygram-app/issues/58) now tracks the nine end-to-end product tracks and their technical acceptance boundaries.
- All nine products begin design, threat-model, API/schema-contract and test-case preparation immediately. Actual implementation is parallel only where dependencies and file/schema ownership are isolated.
- FB and Messenger are the first complete user journeys. Twitty/Insta/WHATSMYGRAM proceed on shared social/media/identity contracts. Meeting/Tube/TikToks/AI require provider, capacity, privacy and cost gates before production-grade claims.
- The neutral 30% assessment remains historical until item-level weighted evidence is populated. New score contract: 15% shared platform + 45% product portfolio + 15% integration + 15% security/quality + 10% release/operations.
- No percentage rises from documentation, issues or a green unrelated job. Each completed acceptance item must name exact SHA, environment, test, artifact and reviewer.
- PR #54 remains Open/Draft/Not Merged. Production remains READ-ONLY. Gate A remains OPEN.

Full criteria: [PRODUCT-DELIVERY-SCORECARD.md](PRODUCT-DELIVERY-SCORECARD.md) and [DECISION-12-PRODUCT-DELIVERY.md](DECISION-12-PRODUCT-DELIVERY.md).

---

# MYGRAM | DECISION 11 ADDENDUM — Execution acceleration | 2026-10-31

> This addendum supersedes the older sequence below where it conflicts. The six delivery lanes remain in force; work may run in parallel only with isolated file/schema ownership and serialized integration by one controller.

- Baseline [Run #120](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41180528483): **SUCCESS** on `444c3fecd9951aca90695534100bb2f782c7ddea`. Existing CI only; it does not execute `qa-authz-two-user` or build Android.
- PR #54 remains **Open / Draft / Not Merged**. Production remains **READ-ONLY**. Gate A remains **OPEN**.
- GitHub path-specific history returned zero commits for each of the five missing Staging migration files. Do not fabricate SQL or change migration history. Migration source recovery remains the only blocker for dependent Staging DDL; Android, frontend acceptance, test design and localization automation continue independently.
- Priority lanes: A (migration integrity, membership/RLS/AuthZ) is the security critical path; B (Android) and C (core FB/Messenger experience) start in parallel now; F (independent QA/release evidence) prepares tests in parallel; E (localization automation) proceeds as P2; D (subsequent product breadth) waits until FB/Messenger core acceptance.
- Release dependencies: no invitation import or tester access before Gate A; no tester APK distribution before Gates A and B plus independent human security review and owner authorization.
- Initial roster correction: the external CSV was re-opened and validated as 8 unique, non-empty rows with explicit roles: 1 owner + 7 testers. No roles were inferred. The CSV remains outside Git and has not been imported. 43 additional tester places remain to reach the 50-tester limit.
- Every delivery must cite an issue, branch/commit SHA, exact tests, environment, rollback method and retest evidence. One CI success cannot certify a later SHA.

See [DECISION-11-PARALLEL-EXECUTION.md](DECISION-11-PARALLEL-EXECUTION.md) for the full lane charter, dependency matrix and release gates.

---

# MYGRAM | DECISION 09 — Operating model and parallel execution charter

Date: 2026-10-31  
Repository: `MYGRAM-DB/mygram-app`  
Integration branch: `rebuild/phase-a-architecture`  
PR #54: Open / Draft / Not Merged  
Production: READ-ONLY

## 1. Purpose

Turn management decisions into a single, verifiable execution system. The goal is to reduce idle hand-offs and duplicate audits without weakening security, testing, or release controls.

This is an execution charter, not a claim that the listed workstreams are staffed by separate human teams. GPT-6 may coordinate and execute engineering work through available connected tools within granted permissions. A human independent security/release reviewer remains necessary for final approval; GPT-6 cannot independently approve its own security work.

## 2. Non-negotiable controls

1. GitHub repository `MYGRAM-DB/mygram-app` is the canonical source of code and technical decisions.
2. All active rebuild work targets `rebuild/phase-a-architecture` or feature branches created from its verified HEAD. Integration is centralized through reviewed commits/PRs; do not create competing project copies.
3. `main` remains protected. PR #54 remains Open / Draft / Not Merged unless the owner explicitly changes that decision.
4. Supabase Staging `cbyvtehvaojxfcgpelir` is the only environment for authorized implementation and tests.
5. Supabase Production `rocztskcyakvekokftfx` remains read-only.
6. No paid service, subscription, card, PageShare, or public deployment is authorized by this charter.
7. No Service Role/Secret key is allowed in browser code, APK assets, source maps, test artifacts, or client logs.
8. No RLS weakening, public Storage bucket, migration history rewrite, or production data copy.
9. Never put tester email lists in Git, PR comments, issues, build logs, screenshots, test reports, or public artifacts. Keep personal invite data in a controlled Staging-only path.
10. An audit is repeated only when source/schema/config/commit has changed, a previous result is stale, or new evidence contradicts it. Preserve old evidence and record the SHA/config it actually tested.

## 3. Leadership and functional lanes

### Technical coordination

**Coordinator:** GPT-6 for engineering orchestration, task decomposition, repository changes, code review assistance, test execution through available integrations, evidence tracking, and blocker escalation.

**Human accountability:** Owner retains product/business decisions, cost authorization, Production release decisions, and tester approval. A human independent reviewer must review security-sensitive SQL/Auth/RLS/Storage and release evidence. Do not mark self-reviewed work as independently approved.

### Lane A — Identity, backend and security

Scope:
- Invitation lifecycle and membership schema on Staging.
- Supabase Auth Before User Created hook.
- Preserve `on_auth_user_created` and `public.handle_new_user()`.
- Membership enforcement in RLS, Storage and Realtime.
- Independent AuthZ A/B/C testing, token expiry/revocation, cleanup proof and migration integrity.

Exit evidence:
- One owner and at most 50 active tester memberships.
- Non-invited, expired, revoked and over-capacity attempts denied.
- A/B access allowed only according to product rules; C denied.
- Revocation blocks new REST, Storage and Realtime access despite an unexpired JWT.
- Existing feed `USING (true)` policies are replaced/narrowed; no additive permissive policy that leaves the old allowance effective.
- Private buckets remain private; owner/participant checks remain in place.

### Lane B — Android

Scope:
- Capacitor native wrapper and checked-in Android project.
- Staging-only package identity `com.mygram.app.staging`.
- Locally bundled web assets; no remote website shell.
- Deep links for email confirmation and password recovery.
- Gradle debug APK, checksum, provenance and CI artifact.

Exit evidence:
- Reproducible clean-checkout build.
- APK signature and package ID verified.
- Build guard proves the only Supabase target is Staging.
- No privileged credential or source map in the package.
- App installed and exercised on physical Android devices.
- Auth callbacks work from installed application, including cold-start and warm-start cases.

### Lane C — Core frontend and experience

Scope:
- React/TypeScript application shell, routing, responsive layout, accessibility, loading/error states and account journey.
- Mobile navigation, safe areas, keyboard resize and Android Back behavior.

Exit evidence:
- No blank screen or fatal console/runtime errors.
- Authentication and profile onboarding are usable on web and Android.
- UI status labels match implemented behavior, never marketing assumptions.

### Lane D — Product functionality

Priority:
1. MYGRAM FB: posts, comments and reactions, permissions, deletion and real-user interaction.
2. MYGRAM MESSENGER: direct conversations, two-party membership, messages, private attachments and Realtime.
3. Other products are not to be promoted as completed. Their architecture and dependency planning can proceed, but core release scope comes first.

Exit evidence:
- Feature-specific tests and A/B/C permission tests.
- No acceptance based only on static UI or database table presence.

### Lane E — Localization and country data

Scope:
- Full language resource inventory, per-locale translation files, locale fallback, key parity, RTL/LTR, date/number formatting and mixed-language detection.
- Country and dialing-code data validation.

Exit evidence:
- Sixty database locale rows are not treated as sixty complete translations.
- No key silently falls back to a different language inside a fully selected locale except documented product names/technical identifiers.
- Automated missing-key, placeholder, plural, RTL/LTR and rendering checks.

### Lane F — Independent quality, security and release

Scope:
- Test strategy, Playwright, integration suites, Android device matrix, artifact provenance, smoke tests, rollback and acceptance evidence.
- Separate test ownership from feature implementation.

Exit evidence:
- CI tests on exact commit SHA.
- AuthZ runtime suite actually executes; syntax checks alone do not count.
- Hosted/installed tests are distinct from localhost tests.
- Critical open issues have severity, owner, reproduction, fix SHA and retest result.

## 4. Parallel execution rules

Work in parallel only when file ownership and dependency boundaries are clear.

Allowed parallel streams:
- Android wrapper/build pipeline can proceed using synthetic Staging configuration while invitation/RLS engineering is in progress.
- AuthZ/schema design and Android app/deep-link source work can proceed in distinct files.
- Locale inventory and missing-key automation can proceed separately from FB/Messenger feature implementation.
- Independent QA may prepare test cases while developers implement fixes.

Forbidden concurrency:
- Two agents must not edit the same file or SQL migration simultaneously.
- No direct concurrent pushes to the integration branch. Work on isolated feature branches or submit bounded patches for a single integrator.
- No second implementation of the same task by a different tool unless explicitly requested as an independent review.
- No deployment workflow may run untrusted pull-request code with Staging deployment secrets or privileged OIDC tokens.

Each work item must state: owner/lane, exact files or schema objects, dependencies, acceptance criteria, risk, test command, and rollback method.

## 5. Severity and prioritization

- **P0:** Active security exposure, data loss/corruption, privilege escalation, Production impact, exposed secret. Stop affected release path and contain immediately.
- **P1:** Core journey blocked, AuthZ failure, cross-user data exposure in Staging, failed Android install/launch, data integrity or migration drift blocker.
- **P2:** Important incomplete product functionality, localization completeness, performance or reliability issues without immediate data exposure.
- **P3:** Visual polish and non-blocking convenience improvements.

Within each severity, choose the smallest independently verifiable change. Do not postpone a P0/P1 issue to increase feature count.

## 6. Single operational task board

The following IDs are the controlling short-list. Preserve detailed historical evidence in the audit docs; update status here only when new evidence exists.

| ID | Priority | Work item | Lane | Exit evidence |
|---|---|---|---|---|
| MY-0411 | P1 | Invite/membership schema and signup hook | A | [Issue #55](https://github.com/MYGRAM-DB/mygram-app/issues/55): allow/deny tests, preserved profile trigger |
| MY-0412 | P1 | Replace overbroad Staging feed reads and add membership to all RLS paths | A | [Issue #55](https://github.com/MYGRAM-DB/mygram-app/issues/55): direct JWT tests for A/B/C and revoked user |
| MY-0413 | P1 | Messenger/Storage/Realtime membership and revocation | A | [Issue #55](https://github.com/MYGRAM-DB/mygram-app/issues/55): two-party and non-member denial tests |
| MY-0414 | P1 | Capacitor 8 Android native project and local asset build | B | [Issue #56](https://github.com/MYGRAM-DB/mygram-app/issues/56): reproducible APK CI artifact |
| MY-0415 | P1 | Native Auth callback and password recovery | A/B | [Issue #56](https://github.com/MYGRAM-DB/mygram-app/issues/56): real device email callback tests |
| MY-0416 | P1 | Android physical-device QA and checksum provenance | F | [Issue #56](https://github.com/MYGRAM-DB/mygram-app/issues/56): signed APK, installed-device matrix |
| MY-0417 | P1 | Independent `qa-authz-two-user` runtime gate | F | [Issue #55](https://github.com/MYGRAM-DB/mygram-app/issues/55): fresh OIDC token, runtime success and cleanup |
| MY-0418 | P2 | SMTP delivery verification for invite/auth mail | A/F | External mailbox delivery proof |
| MY-0419 | P2 | Locale key parity and complete translation pipeline | E | Missing-key/RTL/LTR test report |
| MY-0420 | P2 | FB/Messenger core UX and feature acceptance | C/D | Product-specific acceptance evidence |
| MY-0421 | P1 | Human-accessible Staging web preview or approved alternative | B/F | Actual URL and access-control tests |
| MY-0422 | P1 | Production profiles privacy remediation proposal, Staging-validated only | A/F | [Issue #57](https://github.com/MYGRAM-DB/mygram-app/issues/57): independent review; Production read-only until separate authorization |

Task IDs above are new tracking labels; they do not close, rename, or replace the existing MY-0401 through MY-0410 historical audit items.

## 7. Initial tester intake | batch 01

The owner supplied an initial list outside the repository.

- CSV rows: 8; unique non-empty addresses: 8; empty or duplicate addresses: 0.
- Every CSV role is explicit: 1 owner + 7 testers; no inferred roles.
- Remaining to target: 43 additional testers to reach the 50-tester limit, separate from the owner.
- This checks CSV structure, uniqueness and role values only; it does not prove mailbox deliverability or authorize import.
- No email addresses are stored in this repository document or the CI workflow.
- The list has been prepared as an owner-held CSV outside Git. It has not yet been imported into Staging because the invitation/membership schema and Auth hook are not implemented and verified.
- The tester ceiling is 50 plus the owner, not 50 total.
- Do not issue invites or grant database membership until the server-side invite gate and RLS checks are active and the owner confirms the two inferred tester roles.

## 8. Daily evidence/reporting format

Daily report should be a compact facts-only record, not a narrative status essay:

- Date and repository commit SHA.
- Tasks closed today, with PR/commit/CI links.
- Tasks in progress, owner/lane, next verifiable output.
- P0/P1 issues and any blocker requiring owner decision.
- CI runs with exact tested SHA and final result.
- Staging migration/Auth/Storage changes with backup and rollback evidence.
- APK version/package/signature/SHA-256 and physical-device test results, when applicable.
- Invitation count only; never include tester addresses in the report.
- No percentage estimate unless measured from a defined acceptance checklist.

A task is complete only when its acceptance evidence is linked. Code written, migration proposed, workflow started, or build artifact generated is not by itself a completed feature.

## 9. Execution sequence

1. Lock and review the invitation/membership design; protect Staging with server-side signup denial and runtime authorization.
2. In parallel, establish the Capacitor project and Staging-only Android build pipeline, using test configuration and no tester PII.
3. Add and test native Auth deep links and SMTP delivery.
4. Complete RLS/Storage/Realtime authorization and independent A/B/C test execution.
5. Produce the first APK artifact, verify checksum/signature, then install on the owner's physical device.
6. Expand to the approved testers as their email list is received and validated.
7. Continue FB/Messenger core acceptance and localization completeness without claiming the remaining seven products are delivered.
8. Obtain independent human security/release review before any public/Production release.

This order allows parallel preparation while retaining a hard release dependency on security and identity gates.

## 10. Cost and release authorization

- The owner has rejected PageShare Premium and all paid subscriptions for this preview/testing scope.
- Use free-tier tools only, while checking their actual limits and retention before relying on them.
- GitHub Actions artifacts require repository read access and expire according to the repository/retention configuration. Treat artifacts as temporary delivery, not permanent file hosting.
- Firebase App Distribution is an optional distribution candidate, not yet configured. Its current published limit is up to 500 testers per project and 200 per group; 50 testers fit. Verify the actual Firebase project's no-cost terms and access policy before setup.
- No public web release, Play Store release, PR merge or Production change is authorized.

## 11. Current evidence pointer

- Decision 08 commit: `93dc0584d6318977a7c39ea27e54c42f1f1d8638`.
- [Run #118](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41153182603): SUCCESS on exactly that SHA; validates existing build/Playwright and current Staging Messenger suite only. It does not build Android or execute the independent `qa-authz-two-user`.
- PR #54 remains Open / Draft / Not Merged.
