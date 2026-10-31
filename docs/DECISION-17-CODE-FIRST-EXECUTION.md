# MYGRAM | DECISION 17 — Code-First Parallel Execution Order
**Date:** 2026-10-31  
**Repository:** `MYGRAM-DB/mygram-app`  
**Integration branch:** `rebuild/phase-a-architecture`  
**Workshop branches:** `feature/workshop-*`  
**Parent portfolio:** Issue #58  
**Binding controls:** Decisions 11–16; Issues #55, #56, #57 and #60

## 1. Executive order

Decision 16 opened 13 workshops. The current report confirms all 13 workshop branches were fast-forwarded to integration SHA `8f0285313b0c072918648dc5d4ee4e5dcdf149a6`, without force-push. GitHub's branch API read-back confirms all 13 refs and the integration branch point to that exact SHA. Workflow run `41189301311` completed SUCCESS on that SHA for the two existing jobs.

**This closes workspace synchronization only. It does not mean a product code change was delivered.** The next phase is now formally CODE-FIRST.

Effective immediately:
- Every workshop must produce a source-code change and an automated test as its first implementation output. A second planning-only report is not accepted.
- Product branches work in parallel. Shared contracts and migrations remain single-owner.
- A product team must continue with independent work while waiting for a shared contract, using a typed adapter boundary and deterministic tests. It must not invent a table, column, policy, storage bucket or provider.
- No workshop may report a feature as complete until its real end-to-end persistence, authorization and acceptance tests pass.
- The integration controller alone advances the integration branch; product branches are integrated one at a time and retested.

## 2. Mandatory first code delivery for each workshop

### W1 — MYGRAM FB | Issue #73 | `feature/workshop-fb`
The current `SocialFeedWorkspace` already implements text post creation, top-level comments, reactions, and owner-scoped deletion. Do not rebuild those flows.

**First code delivery:** add nested comment replies using the existing `parent_comment_id` field, and implement edit-own-post with safe loading/error/duplicate-submit states. Add tests for root/reply hierarchy, author identity and reply ordering. Wire a Public/Private selector only after W10 publishes the exact schema contract; the product contract is already approved in Decision 15. No feed migration is owned by W1. Feed RLS changes stay under #60 and the migration owner.

### W2 — MYGRAM Messenger | Issue #74 | `feature/workshop-messenger`
The current UI handles pairwise conversations, messages, private attachments and a private Realtime channel. Its present conversation schema is a two-user model; do not pretend it already supports groups.

**First code delivery:** implement stable cursor-based message history pagination, preserve chronological order, guard stale async loads/channel callbacks when changing conversations, and harden attachment failure cleanup and signed-link failure states. Add component/helper tests. In parallel, prepare group conversation UI against W10's versioned group contract, but do not issue group SQL or claim group acceptance before the schema and membership policies are reviewed. Read/delivery receipts and typing/presence require an explicit shared event/data contract before implementation.

### W3 — WHATSMYGRAM | Issue #75 | `feature/workshop-whatsmygram`
**First code delivery:** implement a pure phone-number normalization/validation module driven by selected country calling-code metadata, plus tests for international prefix, country changes, invalid lengths, empty values and normalization. It must clearly distinguish an entered/candidate phone number from a verified phone identity. Do not implement contact upload or send SMS until consent, anti-enumeration, OTP and provider contracts are approved. No new Auth provider or duplicate Messenger backend.

### W4 — MYGRAM Insta | Issue #76 | `feature/workshop-insta`
**First code delivery:** implement a product-owned story lifecycle module: creation metadata, expiry calculation, visibility decision input, and expired-content exclusion, with deterministic clock-injected tests. Build the workspace against W10's shared media/social adapters. Do not create a second upload path or public bucket. Stories must never be exposed based only on client-side expiry.

### W5 — MYGRAM Twitty | Issue #77 | `feature/workshop-twitty`
**First code delivery:** implement a short-post/thread domain module: length validation, reply/thread construction, repost/quote relation types and deterministic feed ordering, with tests for malformed or cross-owner references. Connect persistence only after W10 approves the social-content contract. Do not duplicate FB authentication or bypass Decision 15 privacy.

### W6 — MYGRAM Meeting | Issue #78 | `feature/workshop-meeting`
**First code delivery:** implement a meeting lifecycle and role-transition module covering scheduled/live/ended/cancelled states, host/participant permissions, chair transfer and invalid transition rejection, with deterministic tests. Build the provider adapter interface in parallel. No media credentials, real recording, or 30-participant capability claim until SFU choice, consent, cost and capacity testing are approved.

### W7 — MYGRAM Tube | Issue #79 | `feature/workshop-tube`
**First code delivery:** implement a media-processing state machine covering initiated/uploaded/queued/processing/ready/failed/deleted states, idempotent retry and invalid transition rejection, with tests. Build channel/metadata consumer against the W10 media contract. Do not create a second bucket or imply transcoding/streaming works until an approved provider and pipeline are deployed and tested.

### W8 — MYGRAM TikToks | Issue #80 | `feature/workshop-tiktoks`
**First code delivery:** implement a vertical-feed playback controller/state module: active clip selection, pause/resume, visibility changes, low-bandwidth fallback signals and cleanup on route change, with tests. Consume the same W10 media pipeline as Insta and Tube. No direct public media URL or independent upload pipeline.

### W9 — MYGRAM AI | Issue #81 | `feature/workshop-ai`
**First code delivery:** implement a server-side provider-neutral request boundary with authenticated user identity, input size/rate/quota checks, explicit data-scope authorization and normalized provider errors. Add deterministic fake-provider tests for denial, timeout, retry and quota exhaustion. No live provider call, paid spend, or browser/mobile secret. Never pass private message/meeting content without the relevant authorization and consent.

### W10 — Shared platform contracts | Issue #82 | `feature/workshop-platform-contracts`
**First code delivery:** create versioned TypeScript contracts and contract tests for Identity/Profile, social visibility, group messaging events, media lifecycle/signed access, notifications, moderation/audit, error envelopes and idempotency. Publish a file/schema ownership matrix. Inspect actual Staging schema before selecting identifiers. Own shared schema proposals and the read-only migration-source validator; do not apply Staging migrations until Gate A/migration provenance review authorizes it. Product teams must consume these interfaces rather than define their own copies.

### W11 — Localization | Issue #83 | `feature/workshop-localization`
**First code delivery:** establish a real locale resource structure for the active foundation screens (Arabic and English first), plus automated key-parity, missing-key, placeholder and fallback tests. Then expand locale-by-locale using the existing locale catalogue with provenance. Add RTL/LTR browser assertions. Do not translate only the registry labels and claim 60-language completion; audit the reported 2,820 catalog entries and 205 country records separately.

### W12 — Marketplace and internal ads | Issue #84 | `feature/workshop-marketplace-ads`
**First code delivery:** implement typed listing/search/filter domain functions and a sponsored-placement eligibility/frequency-cap policy with tests. Sponsored content must be explicitly labeled and must not use private messages, sensitive profile values or hidden location for targeting. Build the workspace through W10 contracts. No wallet, charging, billing, paid campaign activation or Production data.

### W13 — Admin and operations | Issue #85 | `feature/workshop-admin-ops`
**First code delivery:** implement privacy-redacted audit event types, correlation IDs and a health/incident signal contract, with tests that reject sensitive values/secrets in logs. Build admin views only on server-authorized data contracts. No service-role credential in browser code, no broad admin query, and no Production mutations.

## 3. Shared dependency fast lane

W10 must publish its first versioned contract files and ownership matrix before dependent product integrations. It must not become a queue that stops independent work:
- W1 may implement nested replies/edit using current reviewed fields while visibility UI waits for the exact schema contract.
- W2 may implement pagination/load lifecycle against the current pair conversation model while group flows wait for group contract and RLS.
- W3, W5, W6, W7, W8 and W9 can produce pure, tested domain modules and provider interfaces without schema mutation.
- W4, W7 and W8 must use one media state/authorization contract.
- W11 can start Arabic/English resource parity and automated RTL checks immediately.
- W12 can implement listing/filter/ad-policy domain logic while persistence is pending.
- W13 can implement logging/redaction contracts without exposing real admin data.

No team waits idle for another team: it must complete its non-blocked code/test tasks and record the exact dependency.

## 4. Critical security lane is not paused

Issues #55 and #60 continue as P0 independently of all 13 workshops:
1. Recover migration sources from trusted provenance and reconcile the actual Staging ledger version-by-version. Resolve the four-vs-five report discrepancy; do not fabricate SQL.
2. Complete the approved Public/Private feed contract from Decision 15 in schema/policy design.
3. Harden OIDC with exact trusted workflow provenance, source repository identity and replay/negative tests.
4. Deploy and call `qa-authz-two-user` only after review; add a separate functional CI job with independent A/B/C JWT assertions.
5. Complete access-token expiry/revocation, Realtime unauthorized access, signed avatar URL expiry/denial and resource cleanup tests.
6. Keep private Storage buckets and profile projections protected.
7. Obtain independent human security review before closing Gate A.

The existing green CI run `41189301311` does not close Gate A: its current Staging job runs the existing Messenger suite, not the separate AuthZ function.

## 5. Integration protocol

- Every first code delivery must be a focused commit on its workshop branch, with code + tests + concise evidence in the issue.
- The branch must remain based on the current integration ancestry. Rebase/fast-forward only; no force push.
- Before PR creation, verify the diff contains only the workshop's declared file ownership. Shared contracts/migrations require W10/migration-owner review.
- CI must test the exact head SHA. A previous green SHA does not certify later commits.
- The integrator merges no PR under this order. PR #54 and PR #59 remain Open/Draft/Not Merged.
- Product code that needs a pending schema/provider must include a typed boundary and tests, not an invented live endpoint.
- Do not add dummy seed data or hard-coded mock responses to the shipped app.

## 6. Release and safety boundaries

- Staging ref `cbyvtehvaojxfcgpelir` only for authorized runtime work.
- Production ref `rocztskcyakvekokftfx` remains READ-ONLY.
- No RLS weakening, public Storage, Service Role in client, secrets in source/logs/artifacts, destructive migrations or history rewrites.
- No invites, APK distribution, public preview, paid provider/SMS/SFU/CDN/AI activation or financial transactions until their separate gates and owner approvals.
- No one is to report “13 products in development” as 13 active coding teams until named human/agent implementers are explicitly assigned. Branches and issues are workspaces, not workers.

## 7. Required output from the next implementation cycle

For each of W1–W13:
1. One code-bearing commit on its dedicated branch.
2. Tests for the new behavior and at least one negative/failure case.
3. A list of exact files changed.
4. Exact SHA and CI run link.
5. Any schema/provider dependency clearly marked Blocked, with non-blocked work completed.
6. No merge or deployment implied by a source commit.

The next portfolio report must list code commits and test results, not repeat the branch synchronization table.

**Final command: Start the first code deliverable in all 13 workshops now, concurrently within their ownership boundaries. Continue P0 security work at the same time. Synchronization is finished; code and acceptance evidence are now the required output.**
