# MYGRAM | DECISION 14 — Executive Execution Order
**Date:** 2026-10-31  
**Authority:** Project executive engineering directive  
**Governing baseline:** MASTER EXECUTION DIRECTIVE v1.0; Decisions 11–13  
**Status:** ACTIVE — implementation must be evidenced by commits and passing acceptance tests.

## 1. Executive ruling

The project moves from parallel foundation activity to controlled delivery. The immediate objective is not to increase the number of open workstreams; it is to close the release-blocking security and identity gaps, make the Android lane reproducible, and finish the first usable product slice.

No workstream may report completion based on a plan, UI shell, schema presence, syntax check, or successful build alone. Completion requires the exact commit, executed test, environment, result, and acceptance evidence.

## 2. Priority and execution sequence

### P0 — Close Staging Gate A (first priority)
**Tracking:** [Issue #60 — Staging RLS and real AuthZ A/B/C acceptance](https://github.com/MYGRAM-DB/mygram-app/issues/60)

The security lane owns the following sequence:

1. Define and record intended visibility for posts, comments, and reactions before changing policies.
2. Resolve the three audited Staging authenticated SELECT paths using permissive `USING (true)` policies:
   - `posts_select_authenticated`
   - `post_comments_select_authenticated`
   - `post_reactions_select_authenticated`
3. Correct the AuthZ QA fixture model: server-side QA-only fixture seeding/cleanup; all access-control assertions must use independent real A/B/C user JWTs.
4. Harden GitHub OIDC trust to exact repository/owner identity and approved workflow/event/ref/commit provenance. Use a fresh token per call and test positive, negative, replay, and untrusted PR cases.
5. Deploy and execute `qa-authz-two-user` in Staging as a separate CI gate. Syntax validation does not count.
6. Add actual token expiry/revocation, Realtime live-channel, signed avatar URL authorization/expiry, and independent post-cleanup absence checks.
7. Produce a reviewed, reversible Staging migration and attach exact SHA + CI run + per-case results.

**Important:** Run #124 passed its existing build/Playwright job and its existing Staging JWT/Profile/Storage/Messenger/Realtime suite. It did **not** deploy or execute `qa-authz-two-user`; Gate A therefore remains OPEN.

Production's separately audited permissive `profiles` SELECT path must have a reviewed remediation proposal and rollback plan, but **no Production change is authorized by this decision**.

### P1 — Make Android Staging reproducible and testable
**Tracking:** [Issue #56 — Android Staging APK](https://github.com/MYGRAM-DB/mygram-app/issues/56)  
**Implementation review:** [PR #59](https://github.com/MYGRAM-DB/mygram-app/pull/59)

1. Review the generated Android source and exact dependency lock from the Run #9 source artifact; version the reviewed native project and dependency lock in the Android branch.
2. Change the workflow so a clean checkout builds from committed native source and committed, pinned dependencies. It must not depend on transient package installation or an uncommitted generated tree.
3. Implement Supabase email-confirmation and password-recovery callbacks for native Android, covering cold start, warm start, PKCE/state safety, and safe failure handling.
4. Re-run the build from a clean checkout and preserve evidence for package ID, Staging-only endpoint, signature, permissions, and checksum.
5. Install on an owner-controlled physical Android device and test registration, email confirmation, recovery, onboarding, RTL, keyboard/back navigation, FB, and Messenger.
6. Keep the artifact non-distributed until Gate A, independent human review, device acceptance, and owner authorization all pass.

Run #9 proves that an ephemeral runner built and verified a **Staging Debug APK**. It does not prove physical-device acceptance, release signing, deep links, or production readiness.

### P2 — Finish the first usable web product slice
Limit active product implementation to:
- **MYGRAM Identity/Profile**
- **MYGRAM FB**
- **MYGRAM Messenger**

Complete the end-to-end user journeys: signup/sign-in, email confirmation, profile completion, feed publishing and visibility, comments/reactions, direct/group messaging, private attachment access, realtime delivery, and recovery. Each journey needs positive and negative tests using separate accounts.

The seven other products remain registered as **not implemented**. Do not create parallel placeholder workstreams or mark them partial without working functionality.

### P3 — Localization and remaining products
After the first usable slice passes acceptance:
- Complete real translated UI resources and RTL/LTR tests. A 60-language registry alone is not translation completion.
- Complete country/phone metadata and phone OTP only after provider and verification acceptance.
- Start WHATSMYGRAM, Insta, Twitty, Meeting, Tube, TikToks, and AI as separately scoped product increments with their own acceptance criteria.

## 3. Non-negotiable boundaries

- Production Supabase project `rocztskcyakvekokftfx` remains **READ-ONLY**.
- All implementation and runtime QA use Staging `cbyvtehvaojxfcgpelir`.
- Never disable or weaken RLS, expose private Storage, leak secrets, or use a Service Role credential in browser/mobile code.
- Do not invent or rewrite the five missing Staging migration sources. Recover originals or document a safe, independently reviewed reconciliation plan.
- PR #54 and PR #59 remain **Open / Draft / Not Merged** until their gates pass and the owner separately authorizes a merge.
- No tester invitations, APK distribution, public preview, public release, payment enablement, or production deployment under this decision.
- Do not claim an independent human security review. It must be performed and recorded by an authorized human reviewer.

## 4. Evidence and reporting standard

Every task closes with all five items:
1. **Change:** exact files and commit SHA.
2. **Environment:** Staging project/ref or local test environment.
3. **Execution:** exact CI run and job, or reproducible manual test record.
4. **Result:** pass/fail per acceptance case, including denied unauthorized paths.
5. **Recovery:** rollback/compensating migration or code revert plan.

Report status using only:
- **Examined** — source or environment inspected.
- **Changed** — code/migration/config committed or deployed to Staging.
- **Tested** — test actually executed against the stated environment.
- **Accepted** — acceptance criteria met and evidence reviewed.
- **Blocked** — dependency or missing authorization identified.

No progress percentage is to be reported unless derived from a published weighted acceptance scorecard.

## 5. Immediate command

Begin with Issue #60. Keep the Android lane moving in parallel only on isolated branch `feature/android-staging`. The web product lane may fix only defects required to pass Identity/FB/Messenger acceptance. Do not expand scope until P0 evidence is complete.

**Release authority:** Gate A closure, independent human security review, and explicit owner authorization are separate mandatory approvals. A green build is not a release authorization.
