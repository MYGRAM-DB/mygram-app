# MYGRAM GLOBAL 90 | Executive Execution Order

**Approved:** 2026-10-31  
**Program tracker:** [Issue #86](https://github.com/MYGRAM-DB/mygram-app/issues/86)  
**Integration baseline:** `rebuild/phase-a-architecture`  
**Production Supabase:** `rocztskcyakvekokftfx`  
**Staging Supabase:** `cbyvtehvaojxfcgpelir`

## 1. Executive decision

MYGRAM adopts a 90-day global product and engineering program, with a parallel innovation, awards, and measurable-record track. The target is a coherent, demonstrable, testable pilot with evidence-backed product capabilities and a credible path to scale. The 90-day target is a delivery objective, not a promise that all nine products or a world-record claim will be complete.

## 2. Program tracks

1. **Identity and trust:** signup, sign-in, email confirmation, recovery, profile completion, privacy boundaries, and account lifecycle.
2. **Core social:** MYGRAM FB and Messenger end-to-end vertical slices, including persistence, authorization, realtime behavior, media boundaries, and negative tests.
3. **Shared platform contracts:** identity/profile, social graph, messaging events, media, notifications/deep links, search, moderation, translation, telemetry, errors, idempotency, and retention.
4. **Seven additional products:** WHATSMYGRAM, INSTA, TWITTY, MEETING, TUBE, TIKTOKS, and AI. Each begins with scope, threat model, API/data contract, and a bounded vertical slice; no static shell is counted as delivery.
5. **Security and quality:** RLS, grants, AuthZ A/B/C, OIDC trust, Storage, Realtime, RPC, expiry/revocation, cleanup, performance, accessibility, and recovery.
6. **Localization:** real translated resources, locale selection, RTL/LTR behavior, country and phone metadata, and language-isolation tests.
7. **Mobile and preview:** isolated Staging web preview with access controls, Android source/build reproducibility, deep links, and physical-device acceptance.
8. **Innovation and awards:** evidence register, measurable impact metrics, award eligibility research, and a pre-validated record proposal.

## 3. Ninety-day sequence

| Window | Delivery focus | Exit evidence |
|---|---|---|
| Days 1-10 | Baseline reconciliation, security blockers, shared contracts, test harness repair | Exact source SHA, migration provenance, real A/B/C AuthZ plan, reviewed architecture |
| Days 11-30 | Identity, profile, FB, Messenger | End-to-end flows, independent-user negative tests, recovery and realtime evidence |
| Days 31-50 | Shared services and priority product slices | Versioned contracts, integrated slices, Staging preview gate, Android source checkpoint |
| Days 51-70 | Localization, reliability, performance, innovation prototypes | Locale QA, failure/retry tests, measured prototype outcomes, cost and capacity model |
| Days 71-90 | Closed pilot, stabilization, investor and award evidence | Human walkthroughs, defect disposition, security review, pilot metrics, evidence dossier |

## 4. Non-negotiable release gates

- A passing CI run is attributed only to the exact commit SHA it tested.
- Syntax validation is not a runtime authorization test.
- AuthZ acceptance requires independent real JWT sessions for A, B, and C, including positive, negative, expiry, revocation, and cleanup assertions.
- Private Storage stays private. Signed URLs require authorization, expiry, and revocation tests.
- OIDC trust must bind to an approved workflow identity and repository provenance; prefix-only workflow matching is insufficient.
- Staging migrations require provenance, review, and a compensating rollback plan.
- Email confirmation and password recovery must be exercised through real delivery and deep-link flows.
- A human-accessible Staging preview must be access-controlled and explicitly isolated to the Staging project.
- Android acceptance requires reproducible committed source, deep-link tests, and a physical-device walkthrough.
- Product readiness is advanced only by a real UI-to-API-to-persistence-to-authorization workflow with positive and negative tests.

## 5. Authority boundaries

- Production is read-only for this program. No Production DDL, data mutation, Auth/Storage/Edge Function configuration, or deployment is authorized by this order.
- No destructive schema operation, data deletion, migration-ledger rewrite, RLS weakening, public bucket, public preview, tester invitation, APK distribution, or paid provider activation without separate explicit approval.
- No PR merge, Ready-for-review transition, release, or public announcement is implied.
- Staging changes are allowed only when the task is scoped, reversible, reviewed, and tested. Read-only audits may proceed independently.
- Workstreams must use isolated branches and explicit file/schema ownership. One integrator owns shared integration; shared migrations and contracts have one owner at a time.
- If evidence conflicts, stop the affected write and reconcile the source of truth before proceeding.

## 6. Required evidence record

Every task must report:

- **Examined:** exact files, tables, policies, functions, or workflows inspected.
- **Changed:** exact branch, commit, files, migration, or configuration changed.
- **Passed:** exact CI run, commit SHA, runtime test, and result.
- **Remaining:** unresolved risks, missing evidence, and human-only acceptance.

Do not report a task as complete from intention, source presence, screenshots of static UI, or an unexecuted test.

## 7. Innovation and awards workstream

Maintain a separate evidence register with: problem, novelty, implemented capability, baseline, measurement method, result, reproducibility, user impact, cost, and independent verification. Study each award's current eligibility rules before preparing a submission. Any Guinness World Records proposal must identify one measurable, repeatable, independently verifiable record category and obtain the organizer's required approval before attempting or announcing it. Product quality awards and record attempts are separate tracks.

## 8. Initial priority queue

1. Close the AuthZ harness defects and OIDC trust design before deploying `qa-authz-two-user`.
2. Reconcile the five migration ledger/source mismatches from trusted Git history; never invent missing SQL or rewrite applied history.
3. Close Staging preview membership and feed visibility risks without loosening RLS.
4. Define shared platform contracts and ownership with the existing platform workstream.
5. Verify auth confirmation/recovery and mobile deep links.
6. Establish real translation resources and an RTL/LTR acceptance matrix.
7. Build the innovation evidence register and select award/record candidates only after eligibility research.

**This document authorizes safe inspection and isolated development only. It does not authorize production changes, merge, public deployment, tester distribution, or paid service activation.**
