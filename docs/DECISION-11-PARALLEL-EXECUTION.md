# MYGRAM | DECISION 11 — Parallel production acceleration
Date: 2026-10-31
Repository: `MYGRAM-DB/mygram-app`
Execution branch: `rebuild/phase-a-architecture`
PR #54: Open / Draft / Not Merged
Production: READ-ONLY
Gate A: OPEN

## 1. Verified baseline

- [Run #120](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41180528483) completed **SUCCESS** on exact commit `444c3fecd9951aca90695534100bb2f782c7ddea`.
- This proves the existing CI jobs passed on that commit. It does not prove that `qa-authz-two-user` ran, that invitations are protected, or that an Android APK exists.
- PR #54 remains Open / Draft / Not Merged. The documentation commit carrying this decision must receive its own CI run.
- The five missing Staging migration SQL paths were checked against GitHub's path-specific commit history; each returned zero matching commits. The previously recorded Library search also found no matching original SQL file. Recovery remains unresolved.
- The owner-held invitation CSV was re-opened and checked without copying its addresses into Git: 8 rows, 8 unique non-empty addresses, no duplicates/empty addresses, and explicit roles of 1 owner + 7 testers. This corrects the earlier statement that two roles were inferred. The file remains outside the repository and no invite was imported.
- Production has not been changed. No database mutation, Auth hook change, Storage policy change, Edge Function deployment, APK build or distribution is authorized by this decision.

## 2. Command decision: parallel work, serialized integration

The team shall run independent work packages in parallel only where file ownership, database object ownership and dependencies do not overlap. There is one integration controller for the rebuild branch. Feature work must use isolated branches or bounded patches; no direct concurrent pushes to the integration branch and no two workers may edit the same file or migration at once.

Every work item must declare: issue ID, lane, accountable owner, exact files/schema objects, dependencies, risk, acceptance tests, test command, rollback, and evidence link. An issue, code draft, green unrelated workflow, or generated artifact alone is not completion.

## 3. Active production lanes

### Lane A — Migration integrity, identity and Staging authorization (P1 / critical)
1. Search trusted backup/export locations for the five exact missing migration sources. Verify each source against its migration version, provenance and checksum before adding it.
2. Until provenance is established, do not invent replacement SQL, rewrite `schema_migrations`, reset Staging, or apply new schema changes that depend on uncertain history. Read-only catalog capture and design work may continue.
3. Design invitation/membership state in a non-exposed schema with strict grants, unique normalized email, one owner, at most 50 testers, expiry/revocation, and transaction-safe capacity enforcement.
4. Preserve `on_auth_user_created` and `public.handle_new_user()`. Add a fail-closed server-side signup gate and runtime membership authorization; do not rely on user-editable metadata.
5. Replace/narrow the existing permissive `posts`, `post_comments`, and `post_reactions` SELECT policies; do not add a permissive policy beside an existing `USING (true)` policy. Preserve owner, conversation and participant predicates.
6. Add membership enforcement to Messenger, Storage and Realtime. Keep both Storage buckets private.
7. Fix `qa-authz-two-user`: reviewed immutable OIDC trust, admin-only fixture setup/cleanup, independent A/B/C user JWTs for authorization assertions, access-token expiry/revocation, Realtime behavior, replay checks and proof that all temporary Auth/database/storage objects are absent.

**Lane A exit:** exact migration source integrity recorded; invite and membership gates pass positive and negative cases; revoked/non-member users are denied on REST, Storage and Realtime; AuthZ runs as an independent Staging CI gate and cleanup is independently verified.

### Lane B — Android Staging client (P1 / parallel now)
1. Build Capacitor 8 with pinned packages and lockfile; generate the complete native Android project.
2. Use package ID `com.mygram.app.staging`, local bundled assets, no remote `server.url`, relative Vite base and disabled source maps.
3. Add build-time rejection of Production/unknown Supabase refs and checks against privileged keys in app assets/artifacts.
4. Implement email-confirmation and password-recovery deep links for cold and warm starts.
5. Add Gradle CI build, APK package/signature/permissions checks, SHA-256 and short-retention artifact.
6. Install and test owner-only on a physical device. Do not distribute to testers until Lane A and the release gate pass.

**Lane B exit:** reproducible Staging-only APK, provenance/checksum, clean secret scan, working native Auth callbacks, and physical-device acceptance.

### Lane C — Core web/mobile experience (P1 / parallel now)
1. Test the actual implemented FB and Messenger journeys: registration, confirmation, profile completion, feed, comments/reactions, direct chat, attachments and Realtime.
2. Fix loading/error/empty states, mobile navigation, safe areas, keyboard/RTL behavior and Android Back behavior in frontend-owned files.
3. Use synthetic test fixtures until membership authorization is enforced. Do not add client-side bypasses to work around RLS.
4. Keep the product registry truthful: two partial products only; all other products remain not implemented until end-to-end acceptance passes.

**Lane C exit:** reproducible user journeys with Playwright and real Staging acceptance, no fatal runtime errors, accurate product status.

### Lane D — Feature delivery and scope control (P1 then P2)
- Stabilize FB and Messenger before starting breadth work on the other seven products.
- Decompose each later product into schema, RLS, UI, integration, accessibility, performance and negative-permission tests.
- Do not create placeholder screens or database tables and report them as delivered functionality.

### Lane E — Localization and country data (P2 / parallel, non-blocking to core)
- Build key-parity, placeholder, plural, RTL/LTR and mixed-language checks.
- Verify all 60 locale records and 205 country records as registries, not as proof of 60 complete translations or production phone OTP.
- Keep Arabic-first user journeys stable while generating translation gap reports.

### Lane F — Independent QA, release and privacy review (P1 / parallel)
- Prepare A/B/C test cases and release checklists while implementation proceeds; execute runtime suites only against deployed, approved Staging code.
- Each CI result must identify the exact source SHA and environment. A syntax check is never a runtime security test.
- An independent human reviewer must approve security-sensitive SQL/Auth/RLS/Storage/Realtime and release evidence. The implementer cannot self-approve.
- Prepare the Production profile privacy proposal and validate only on Staging. No Production change is included in this work.

## 4. Dependency and gate matrix

| Work | Can proceed immediately? | Hard dependency before completion or distribution |
|---|---|---|
| Migration source recovery | Yes, read-only investigation | Trusted original source and checksum |
| Membership/RLS implementation | Design and source review only while migration provenance is unresolved | Reviewed migration chain and Staging rollback plan |
| Android source/build lane | Yes, with synthetic Staging config | Gate A before tester distribution; owner device test before APK acceptance |
| FB/Messenger frontend QA | Yes, with synthetic/owner fixtures | Runtime membership gate before group preview |
| AuthZ test design | Yes | Hardened function deployment before runtime claim |
| Locale automation | Yes | Does not gate the first secure FB/Messenger preview |
| Production privacy proposal | Yes, read-only analysis and Staging validation | Separate future authorization before any Production mutation |

### Release gates
- **Gate 0 — source integrity:** five migration entries matched to trusted sources, or explicitly escalated as unresolved. No reconstructed file may be labelled original.
- **Gate A — private preview security:** signup deny/allow, membership caps, RLS, Messenger, Storage, Realtime, OIDC AuthZ and cleanup tests pass.
- **Gate B — client integrity:** Staging-only Android artifact, secret scan, callback tests, checksum and owner physical-device sign-off.
- **Gate C — tester rollout:** Gates A and B pass, independent human security review is recorded, and owner explicitly authorizes importing/inviting the confirmed roster.
- **Production gate:** separate change proposal, Staging validation, independent review, rollback plan and separate explicit authorization. Production remains read-only until then.

## 5. Work-in-progress and integration discipline

- Keep at most one primary P1 implementation item active per lane; secondary work must not compete for the same files/schema objects.
- Feature branches must be based on the current verified integration HEAD. The integrator alone advances `rebuild/phase-a-architecture`.
- Each integrated change triggers CI. A green run on an earlier SHA cannot certify a later commit.
- No deployment workflow may expose Staging secrets or privileged OIDC credentials to untrusted PR code.
- Keep tester addresses out of Git, Issues, PR comments, logs, screenshots and artifacts.
- No paid services, public previews, PageShare, subscriptions or Production deployment are authorized.

## 6. Daily executive scoreboard

Report only: exact branch SHA; task and issue IDs completed/in progress/blocked; CI run with exact tested SHA; Staging change and rollback evidence; security reviewer status; APK artifact/checksum/device result when available; and invite counts only. Percentages are prohibited unless derived from a defined acceptance checklist.

## 7. Immediate execution orders

1. Continue the five-source recovery investigation without database mutation.
2. Start Lane B Android source/build work and Lane C frontend acceptance fixes now, on isolated ownership paths.
3. Prepare Lane F's A/B/C runtime tests while Lane A repairs the AuthZ function and membership design.
4. Keep Lane E automation moving as P2, without displacing P1 security and core journeys.
5. Integrate through the single controller, test each exact commit, and keep PR #54 Draft.
6. Do not import the 8-row owner-held CSV, invite testers, distribute an APK, or modify Production until the applicable gates are formally passed.

---
*This decision updates execution coordination only. It does not apply a Staging migration or alter any Supabase configuration.*
