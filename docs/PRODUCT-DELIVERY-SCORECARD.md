# MYGRAM | Product Delivery Scorecard
Date: 2026-10-31
Applies to: `MYGRAM-DB/mygram-app`
Branch: `rebuild/phase-a-architecture`
Current status: evidence baseline only; no percentage uplift is claimed by this document.

## 1. How to read the external 30% assessment

The neutral evaluator's **30% overall**, the nine product estimates, technology estimates and five phase estimates are retained as the historical 2026-10-31 assessment. They are **engineering estimates, not an automated measurement**. The submitted report does not provide the item-level denominators, weights or reproducible acceptance evidence needed to recalculate them. Therefore:

- Do not change the 30% number merely because documentation, issues or CI runs were added.
- Do not compare a new score to 30% until the checklist below has a completed baseline with evidence.
- Keep the evaluator's per-product numbers as reference estimates, not certified readiness.
- A successful build/CI run earns only the checklist points it actually tests.

## 2. Verified code-state cross-check

The product registry on the rebuild branch currently marks:
- `partial`: MYGRAM FB, MYGRAM MESSENGER.
- `not-implemented`: WHATSMYGRAM, MYGRAM INSTA, MYGRAM TWITTY, MYGRAM MEETING, MYGRAM TUBE, MYGRAM TIKTOKS, MYGRAM AI.

This matches the repository README's caution that the registry and navigation shell are not completed products.

### Current CI evidence

[Run #121](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41181799872) completed **SUCCESS** on exact commit `b4adbd1fb2178f5711782c2a6748ff85e3e57c50`.

It ran:
1. Build/quality job: Node tests, Playwright, syntax checks, TypeScript and Vite build.
2. Current Staging security job: `qa-messenger-abc`.

It did **not** execute `qa-authz-two-user`, create an Android project/APK, validate real SMTP/password-recovery delivery, or establish the nine end-to-end product journeys. Do not credit those capabilities to Run #121.

## 3. Official progress calculation from now on

The project-level score is:

```text
MYGRAM readiness =
  15% Shared platform foundation
+ 45% Product portfolio
+ 15% Cross-product integration
+ 15% Security and quality gates
+ 10% Release and operations
```

The product portfolio score is the arithmetic mean of the nine product scores. With equal product weighting, each product contributes 5 percentage points to the overall score.

Each product score is calculated from a fixed acceptance checklist:

| Product dimension | Weight |
|---|---:|
| Real end-to-end user journey | 30% |
| Data model and API integration | 15% |
| Authorization, privacy and abuse controls | 20% |
| UX, mobile responsiveness and accessibility | 10% |
| Automated tests and failure/recovery paths | 15% |
| Observability, reliability and performance | 10% |
| **Total** | **100%** |

Each checklist item is scored only as:
- **0%:** no implementation or no evidence.
- **50%:** implementation exists but acceptance is incomplete or only partly tested.
- **100%:** acceptance criteria passed on an exact commit and environment, with evidence linked.

A mock, static screen, database table by itself, syntax-only check, unresolved PR, or undocumented manual claim earns no completion credit. An item marked not applicable must have a written reason and an approved replacement criterion; it cannot simply be removed to inflate the denominator.

Project-wide dimensions use the same evidence rule and their own published checklists. Any hard security or privacy release gate can block release even when the aggregate score is high.

## 4. Five production-stage scorecards

The independent report's 85/25/10/25/5 phase estimates remain historical. Re-score each phase from these deliverables:

### Phase 1 — Architecture and common foundation
- Product boundaries and ownership documented.
- Shared identity/profile/privacy contracts.
- Shared media, notifications, search, moderation, localization and audit contracts.
- Staging/Production separation and migration provenance.
- Reproducible build, pinned dependencies, CI and rollback.
- Versioned API/schema contracts with no overlapping owners.

### Phase 2 — Product implementation
- One real vertical slice per product.
- Real persistence, authorization and UI, not a registry entry or placeholder.
- Product-specific positive and negative permission tests.
- Error, retry, deletion, abuse and recovery behavior.
- Product status changes only after its acceptance evidence passes.

### Phase 3 — Cross-product integration
Required journeys include:
1. Register → confirm email → complete profile → use account in FB and Messenger.
2. Create content in FB/TWITTY and share/discover it in supported social surfaces.
3. Upload one media asset under a common media contract and consume it according to privacy rules in INSTA/TUBE/TIKTOKS.
4. Share a meeting invitation through Messenger; enforce membership and participant permissions.
5. Invoke MYGRAM AI from an authorized surface without exposing provider credentials or private content.
6. Exercise notifications, identity, blocking/reporting, deletion and revocation across the products that use them.

A product-to-product link is not counted until both sides' permissions and failure behavior pass.

### Phase 4 — Security and acceptance
- Invite/signup deny/allow/cap/expiry/revocation checks.
- RLS tests for independent users A/B/C on REST and RPC.
- Private Storage ownership/viewer/denial/expiry tests.
- Realtime channel join, broadcast, disconnect and revocation behavior.
- Auth token expiry and session invalidation.
- Abuse/rate-limit/input validation and secrets scanning.
- Human review by an independent security reviewer.

### Phase 5 — Release and operations
- Access-controlled Staging web preview.
- Android Staging APK, SHA-256, signature/package/permission checks.
- Physical-device installation and owner acceptance.
- Real inbox confirmation and password recovery.
- Logging, alerts, backup/restore and rollback proof.
- Privacy notice, moderation/report process, support and incident runbook.
- Separate Production release authorization.

## 5. Nine product delivery contracts

| Product | First independently testable vertical slice | Important dependency / gate |
|---|---|---|
| MYGRAM FB | Post lifecycle, feed visibility, comments/reactions, ownership and moderation | Close broad Staging feed reads and apply membership/ownership RLS |
| MYGRAM MESSENGER | Direct conversation, send/receive, read/delivery state, private attachment, Realtime | Independent AuthZ, participant + preview membership, Storage and Realtime tests |
| WHATSMYGRAM | Separate phone-identity/contact product and consent-based contact matching | OTP provider, anti-enumeration, E.164/consent/privacy review |
| MYGRAM INSTA | Image-first post, follow graph, story expiry and private media | Shared media service, visibility policies and signed/private access |
| MYGRAM TWITTY | Short post, replies, repost/quote, hashtags and feed ordering | Shared social graph/feed, rate limits and reporting |
| MYGRAM MEETING | Schedule/join, host controls, chair transfer, working audio/video | WebRTC/SFU decision, concurrency/capacity, consent and network-failure plan; do not claim 30 participants before load/device tests |
| MYGRAM TUBE | Channel, upload, metadata, transcoded/adaptive playback, playlist | Storage/CDN/transcoder architecture, moderation, cost and retention policy |
| MYGRAM TIKTOKS | Short capture/upload, vertical feed, playback and interactions | Shared media/transcoding, feed ranking and moderation |
| MYGRAM AI | Secure assistant request, history, output controls, quotas and usage accounting | Approved server-side model provider, data privacy, secrets and cost controls |

## 6. Shared platform components

Create shared contracts and owners before duplicating implementations:
- Identity, authentication, profile and account recovery.
- Social graph, block/report and privacy.
- Messaging and realtime event conventions.
- Media upload, validation, metadata, storage and signed access.
- Notifications and deep links.
- Search/discovery and moderation.
- Translation resources, locale formatting and RTL/LTR.
- Audit events, telemetry, abuse/rate limits and feature flags.

Shared components should be consumed through versioned interfaces. Do not create a single giant migration or a giant UI component that owns every product.

## 7. Product status vocabulary

Use one of: `not-started`, `design-verified`, `implementation-in-progress`, `partial`, `acceptance-passed`, `release-ready`.

The status is not marketing language:
- `design-verified`: requirements, threat model, data/API contract and test plan reviewed.
- `implementation-in-progress`: code exists but complete acceptance has not passed.
- `partial`: at least one real journey works, but one or more required dimensions are incomplete.
- `acceptance-passed`: all scoped MVP acceptance tests pass on exact SHA and environment.
- `release-ready`: acceptance passed, security review and operational/release gates passed.

## 8. Rules that prevent percentage inflation

1. Record exact commit SHA, environment, tests, artifacts and reviewer for every completed item.
2. Recompute scores only after evidence changes; keep historical score snapshots.
3. Do not award points for duplicated work across phases/products.
4. Do not average away a hard release blocker: show aggregate readiness and gate status separately.
5. Report product score and release eligibility separately. A product may score highly but remain blocked from release.
6. The independent reviewer must be distinct from the implementer for security and release approval.

---
*This file defines a measurement contract. It does not claim new product functionality, database changes or release readiness.*
