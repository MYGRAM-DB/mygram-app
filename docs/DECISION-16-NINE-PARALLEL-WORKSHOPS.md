# MYGRAM | DECISION 16 — Nine Parallel Product Workshops
**Date:** 2026-10-31  
**Repository:** `MYGRAM-DB/mygram-app`  
**Integration branch:** `rebuild/phase-a-architecture`  
**Parent portfolio:** Issue #58  
**Previous binding decisions:** 11, 12, 14, 15  
**Security gates:** Issues #55 and #60  
**Android:** Issue #56  
**Production privacy plan:** Issue #57

## 1. Executive order

Effective immediately, open all nine product workshops in parallel. Every workshop starts now with a defined owner, product boundary, user journeys, threat model, API/data contract, interface plan and acceptance matrix. Implementation may also proceed in parallel where dependencies and file/schema ownership permit. Do not wait for FB/Messenger to finish before beginning design and bounded implementation in the other seven products.

This is controlled parallel engineering, not nine independent applications and not nine empty menu screens. Every product must deliver a real vertical slice through UI → authenticated API → persistent data → authorization → tests.

## 2. Nine mandatory product workshops

| Workshop | Product | First independently testable slice |
|---|---|---|
| W1 | MYGRAM FB | Post lifecycle, Public/Private feed, comments, nested replies, reactions, privacy and A/B/C tests |
| W2 | MYGRAM MESSENGER | Direct/group conversations, send/receive, delivery/read state, private attachments, Realtime and participant isolation |
| W3 | WHATSMYGRAM | Separate phone-identity product, consent-based contacts, E.164, contact discovery and verified OTP lifecycle |
| W4 | MYGRAM INSTA | Image-first publishing, following, stories/expiry, privacy, image variants and media authorization |
| W5 | MYGRAM TWITTY | Short posts, replies, repost/quote, hashtags, feed ordering, reporting and rate limits |
| W6 | MYGRAM MEETING | Schedule/join, roles, host/chair transfer, audio/video SFU, reconnect and multilingual AI/PDF summaries |
| W7 | MYGRAM TUBE | Channel, upload, metadata, transcoding, adaptive playback, captions, playlists and moderation |
| W8 | MYGRAM TIKTOKS | Short-video capture/upload, shared processing, vertical feed, interactions and moderation |
| W9 | MYGRAM AI | Server-side provider adapter, private history, writing/summarization/translation, quotas, audit and cost controls |

All nine tracks open simultaneously. FB and Messenger remain the first end-to-end acceptance and integration priorities, but this must not block design or isolated work in the other seven.

## 3. Four shared platform workshops

**W10 — Shared platform contracts:** identity/auth/profile/recovery; social graph/follow/block/report; messaging/realtime event contracts; media and signed access; notifications/deep links; search; moderation; audit/telemetry; feature flags; error/idempotency conventions. Every shared domain must have one owner and versioned consumer contract.

**W11 — Localization and country data:** actual translation completeness for 60 locales, catalog key parity, placeholders/plurals/fallbacks, Arabic RTL/LTR and mixed-direction tests, validation of 205 country records and phone metadata, and separation of nationality, residence, phone country, locale and time zone. A language registry is not a translated product.

**W12 — Marketplace and internal ads:** seller/listing discovery, safe buyer-seller inquiry via Messenger, reporting/moderation, first-party sponsored placements, clear ad labels, budgets/caps, frequency controls, impressions/clicks and unit-economics modelling. No wallet, escrow, card billing or paid advertiser activation without separate approval.

**W13 — Admin and operations:** least-privilege admin console, moderation queue, audit logs, observability/alerts, abuse/rate limits, quotas, backup/restore drill, performance/load baselines, incident/rollback runbooks and release evidence.

Existing workstreams remain active: #55 membership/signup authorization, #60 Gate A / RLS / AuthZ, #56 Android Staging, #57 read-only Production privacy proposal. They are not replaced by this decision.

## 4. Parallel work boundaries

1. Each workshop uses its own feature branch and named file/module ownership. No two workstreams edit the same component or migration concurrently.
2. One integration controller alone advances `rebuild/phase-a-architecture`. Product branches integrate serially after tests; retest the integrated commit.
3. Shared DB schema/migrations are owned by the platform/migration owner. Product teams submit schema proposals/contracts; they do not independently add overlapping migrations.
4. Media products (Insta, Tube, TikToks) share one media pipeline. They may implement product UI and consumer tests in parallel, but must not create competing upload/storage/transcoding services.
5. FB/Twitty share social/feed primitives only through explicit versioned contracts. WHATSMYGRAM remains a distinct phone/contact product and must not become a duplicate Messenger implementation.
6. Meeting uses an approved SFU/provider design; the 30-participant target is not a capability claim until load and device testing. Recording is consent-gated. Chair transfer is required. AI minutes/PDF use authorized participant content and each participant's chosen language.
7. AI, SMS/OTP, video/SFU, CDN/transcoding and paid infrastructure require provider, privacy, cost and owner approval before live spend. Test adapters are not accepted as live end-to-end completion.
8. Wallet/payments are outside pilot activation. Marketplace inquiry and sponsored-ad measurement may proceed in Staging; live charging is disabled.
9. No tester invitations, APK distribution, public preview or release until Gate A, independent human security review, Android physical-device acceptance where applicable, and owner authorization.
10. Production project `rocztskcyakvekokftfx` remains READ-ONLY. Use Staging `cbyvtehvaojxfcgpelir` for approved implementation and runtime tests only.

## 5. Common outputs required from every workshop

Within its first implementation cycle, each workshop must publish:
- Accountable owner and technical reviewer (do not invent assignments).
- Product boundary, personas, user stories and non-goals.
- User journey and screen map, including empty/error/loading/recovery states.
- Data/API contract, schema ownership and dependencies.
- Threat model, privacy/abuse cases and A/B/C allow/deny matrix.
- Accessibility, responsive, RTL/LTR and performance checks.
- One vertical slice with persisted data and actual authorization.
- Unit/integration/E2E evidence, exact SHA, CI link, environment, rollback and remaining blockers.

A screen, menu item, table, mock response, design document or successful unrelated CI job does not count as an implemented product.

## 6. Priority and dependency plan

**Parallel start, same cycle:** all W1–W13 begin requirements, architecture, threat modelling, contracts and test design.

**Implementation priority inside the parallel program:**
- Core acceptance: Identity + FB + Messenger; membership/RLS/AuthZ #55/#60 remains P0.
- Social expansion: WHATSMYGRAM, Insta and Twitty; shared identity/social/media contracts first.
- Media and communication: Meeting, Tube, TikToks; provider and capacity decisions precede production claims.
- AI: secure provider-neutral implementation in parallel; paid live inference only after approval.
- Cross-product marketplace, ads, localization, admin and operations progress as shared services without blocking independent product UI slices.

## 7. Status and reporting

Use only: `not-started`, `design-verified`, `implementation-in-progress`, `partial`, `acceptance-passed`, `release-ready`. Each status must link to exact evidence. Report by closed acceptance criteria, not by lines of code or estimated percentages.

Daily report: workshop ID, owner, issue, branch, current SHA, changed files/schema objects, tests and exact CI run, Staging proof, reviewer, rollback, blockers and next verifiable output. Every blocked task must state the exact external decision/dependency and continue with a non-blocked task.

## 8. Immediate execution command

Open nine child product issues under #58 and four shared-workshop issues. Create isolated branches from the latest verified integration commit. Assign accountable owners through the project owner; until then, tickets remain unassigned and no human resource is presumed to be working. Keep the P0 security lane moving in parallel. All workshops begin now; no workshop may claim completion until its end-to-end acceptance evidence passes.

**This decision starts parallel workshops and authorizes isolated Staging development. It does not authorize a Production mutation, payment/provider spend, migration deployment without review, merge, tester invitation, or public release.**
