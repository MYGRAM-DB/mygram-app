# MYGRAM | DECISION 15 — Feed Visibility and Gate A Execution
**Date:** 2026-10-31  
**Authority:** Executive engineering decision following the 14-A referral  
**Repository:** `MYGRAM-DB/mygram-app`  
**Execution branch:** `rebuild/phase-a-architecture`  
**Tracking:** [Issue #60 — Close Staging Gate A](https://github.com/MYGRAM-DB/mygram-app/issues/60)

## 1. Executive ruling

The report is accepted as a valid release-blocking security assessment, subject to the reconciliation items in this decision. Gate A remains **OPEN**. This decision authorizes implementation design and source changes on the execution branch, and controlled runtime verification in MYGRAM-STAGING only. It does not authorize a Staging migration deployment, Production change, merge, release, tester invitation, or APK distribution by itself.

## 2. Approved first-release feed visibility contract

The product owner’s initial visibility contract is approved as follows:

| Object | Authorized visibility |
|---|---|
| Public post | Every authenticated MYGRAM account |
| Private post | Its owning account only |
| Comment | Exactly the visibility of its parent post |
| Nested comment | The visibility of the root post in its comment thread |
| Reaction | Exactly the visibility of its parent post |
| Friends-only | Deferred until friendship relationships, blocking, and their authorization rules are implemented and tested |

Additional requirements:

- A new post is **Private by default** unless the user explicitly selects Public.
- “Public” in this first release means visible to signed-in accounts. It does **not** authorize anonymous/visitor access, public object storage, search-engine indexing, or bypassing authentication.
- A user may read their own private post. Other accounts must not read it, enumerate it, or infer its content through comments, reactions, counts, nested comments, or Realtime events.
- A comment or reaction may be created only when the caller is authorized to view the parent post. The write path must validate the parent post and must not permit a child row to widen the parent’s audience.
- No separate audience override is permitted on comments or reactions.
- Invalid, missing, or unsupported visibility values must fail closed. Do not silently coerce unknown values to Public.
- Existing posts must not become Public by migration default. Backfill all existing rows to Private unless a separately reviewed, evidence-based product-owner decision specifies otherwise.

This is a product contract, not permission to deploy SQL.

## 3. Feed schema and RLS work order

1. Inspect the exact live Staging definitions for `posts`, `post_comments`, and `post_reactions`: primary keys, owner column, foreign keys, nested-comment linkage, grants, all existing policies, triggers, views, and Realtime publication membership.
2. Propose one additive post-visibility column with a constrained vocabulary (`public` / `private`), a Private default, and a check constraint. Confirm naming and compatibility with the actual application code before choosing the identifier.
3. Prepare a single reviewed migration that backfills existing posts as Private, installs the constraint/default, and replaces the three broad SELECT policies. Do not add a permissive policy beside an existing broad policy: PostgreSQL permissive policies are OR-combined.
4. Make comment and reaction SELECT policies derive access from the parent post, including nested comments. Avoid recursive policy designs; use a narrowly scoped helper only if its SECURITY INVOKER/DEFINER behavior, grants, search_path, and recursion safety have been reviewed.
5. Keep RLS enabled. Do not grant wider table access, make Storage buckets public, or use client-side filtering as authorization.
6. Prepare rollback/compensation steps and verify the migration against a clean Staging snapshot before application. Recheck row counts immediately before applying; do not assume earlier zero-row audit results remain current.
7. Do not apply until migration-history provenance and the exact source-missing list have been reconciled as specified in section 6.

## 4. Mandatory A/B/C acceptance matrix

Use three distinct temporary Auth users and real, independent user JWTs. Account A creates one Private post and one Public post.

| Test | Expected result |
|---|---|
| A reads own Private and Public posts | Both readable |
| B and C query A’s Public post | Readable |
| B and C query A’s Private post by ID and through feed listing | No row/content disclosure |
| B/C query comments and reactions on A’s Private post | No row/content/count disclosure |
| B/C query comments and reactions on A’s Public post | Readable subject to parent visibility |
| B/C create comment/reaction on A’s Private post | Denied |
| B/C create comment/reaction on A’s Public post | Allowed only where product rules permit |
| A changes own Public post to Private | Subsequent reads by B/C denied; recheck Realtime |
| Invalid/missing visibility | Fails closed; does not become Public |
| Anonymous client | No feed table access |
| Cleanup | Every fixture row, object, and Auth user is removed and independently verified absent |

Tests must exercise PostgREST/API requests and actual JWT sessions, not only SQL policy expressions or syntax checks. Record each assertion separately.

## 5. AuthZ function, OIDC and CI orders

The source-level admin-fixture and isolated-cleanup corrections already recorded in Issue #60 are recognized as **source changes only**. They are not a Staging deployment or runtime acceptance.

Before deployment:

- Keep fixture seeding and cleanup on the server-only QA admin client. Every allow/deny assertion must use distinct real A/B/C user JWTs. Never expose the Service Role credential to the workflow, browser, or mobile client.
- Replace the broad `workflow_ref.startsWith(...)` trust check with an exact trusted-workflow design. Bind repository and owner immutable IDs, exact approved workflow identity/path, approved workflow revision/provenance, event, refs, source repository identity, commit/run identity, issuer, audience, expiry, and not-before. Do not treat branch name and workflow name alone as proof that the workflow code is trusted.
- Do not allow an untrusted fork or unreviewed PR workflow to exercise Staging admin credentials. If immutable workflow provenance cannot be proven for a pull-request run, move the privileged QA invocation into a trusted workflow on a protected ref and independently validate the originating PR/run metadata through the GitHub API before authorizing it.
- Add positive, wrong-claim, expired-token, replay, repeated-call, untrusted-source, and wrong-workflow tests. Consume each OIDC token once and fetch a fresh OIDC token for every separate Edge Function invocation.
- Deploy `qa-authz-two-user` to Staging only after source review. Add a separate functional CI job that invokes it and fails the workflow on any non-2xx result or failed assertion. The current `ci.yml` only syntax-checks `tests/authz.integration.mjs` and invokes `qa-messenger-abc`; that is not AuthZ acceptance.
- Add genuine expired Supabase access-token coverage and refresh-token revocation coverage; do not claim that refresh revocation instantly invalidates an already-issued access JWT.
- Add a live Realtime channel test for unauthorized subscription and event receipt, including behavior after visibility changes and session revocation.
- Keep avatar objects in the private bucket. Specify and test the approved viewer contract for signed URLs, expiration, unauthorized denial, and non-renewability after authorization is removed. A public profile field containing an avatar path is not itself authorization to download the object.
- Make cleanup exception-isolated and independently verify absence of all temporary Auth users, private rows, Storage objects, and Realtime test resources, including after a failed test.

## 6. Migration source-of-truth reconciliation

The submitted report says five historical migration sources were missing; the current `docs/SCHEMA_DRIFT.md` records four applied Staging ledger entries without matching branch files, while the Staging ledger is described as 17 entries and the branch as 13 SQL files. These statements must not be silently merged into one count.

The migration owner must produce a version-by-version reconciliation table from:
- the live Staging migration ledger;
- the complete migration directory on the execution branch;
- trusted Git history, backups, and workflow artifacts.

For each unmatched version, record the exact version/name, whether it is actually applied in Staging, whether a trusted original source exists, its provenance and SHA-256, and the resolution. Recover original SQL only. Do not fabricate replacements, rewrite migration history, reset Staging, or delete an applied ledger entry. If an original cannot be recovered, submit a separately reviewed baseline exception with schema diff, dependency/order evidence, checksums, and validator behavior. Implement a read-only Migration Validator for missing, duplicate, reordered, and checksum-conflicting files before claiming migration integrity.

No feed migration may be applied until this reconciliation has an accepted result and a rollback/compensation plan.

## 7. Additional security findings

- Review `qa_run_challenges`, `ui_translation_cache`, and `ui_translation_daily_usage` individually. If they are intentionally service-only, prove RLS state, absence of client-role grants, and access only through the intended server path. Do not add broad policies merely to silence an Advisor finding.
- Review `complete_mygram_profile` as a SECURITY DEFINER boundary: fixed empty search_path, execution grants restricted from PUBLIC/anon, identity derived from `auth.uid()`, no caller-supplied user ID, safe validation, and real A/B/C negative tests. Do not remove the RPC or change grants without an alternative tested flow.
- Record Leaked Password Protection as a platform/plan limitation if it cannot be enabled on the current plan. Do not claim it is enabled and do not weaken other controls to compensate.
- Prepare a separate Production `profiles` privacy remediation proposal and rollback plan for human review only. Production project `rocztskcyakvekokftfx` remains READ-ONLY.

## 8. Execution sequence and release gates

**P0:** complete migration-source reconciliation; finalize the visibility schema proposal; harden OIDC and AuthZ fixtures; add the functional AuthZ CI job; build the A/B/C feed matrix; complete expiry, Realtime, signed URL and cleanup tests; then apply the reviewed migration to Staging and execute the complete suite.

**Parallel safe work:** prepare the read-only Production remediation proposal; classify the three service-only tables and inspect `complete_mygram_profile`; continue Android source/deep-link work on its isolated branch without distributing APKs.

**Acceptance:** Gate A closes only after the exact commit, Staging project ref, migration version, CI run/job, per-case evidence, cleanup evidence, rollback plan, and an independent human security review are recorded. A green build or the existing Messenger suite is not sufficient.

PR #54 and PR #59 remain Open / Draft / Not Merged. No Production change, public release, tester invitation, or APK distribution is authorized by this decision.

## 9. Required report format

For every work item report exactly one status: **Examined**, **Changed**, **Tested**, **Accepted**, or **Blocked**. Include:
- exact files and commit SHA;
- environment/project ref;
- exact workflow run and job, or reproducible manual evidence;
- positive and negative test results;
- cleanup verification;
- rollback/compensation method;
- named blocker and next action where blocked.

Do not report a completion percentage unless it is calculated from a published weighted acceptance scorecard.
