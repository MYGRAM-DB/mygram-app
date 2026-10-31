# MYGRAM | DECISION 12 — Evidence-based productivity and nine-product delivery
Date: 2026-10-31
Repository: `MYGRAM-DB/mygram-app`
Execution branch: `rebuild/phase-a-architecture`
PR #54: Open / Draft / Not Merged
Production: READ-ONLY
Security Gate A: OPEN

## 1. Executive determination

The neutral report's overall 30% is retained as a provisional external estimate. The supplied percentages are not yet reproducible because the report does not define weighted checklist items or attach evidence for each percentage. No percentage uplift is authorized merely for writing plans, adding issues or passing unrelated CI jobs.

The delivery method changes immediately: **parallel domain execution, shared architecture contracts, isolated ownership, serialized integration and evidence-based acceptance**. All nine product tracks begin requirements, threat-model, API/data-contract and test-design work now. Implementation proceeds in independent slices where dependencies permit. FB and Messenger remain the first production-quality user journeys; the other seven must not be reduced to empty menu destinations or copied shells.

## 2. Latest verified baseline

- [Run #121](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41181799872): **SUCCESS** on exact SHA `b4adbd1fb2178f5711782c2a6748ff85e3e57c50`. Both jobs passed.
- Build/quality job passed Node tests, Playwright, syntax checks, TypeScript and Vite build.
- Staging security job passed its existing `qa-messenger-abc` invocation. It did not execute `qa-authz-two-user`.
- The registry contains nine products; only FB and Messenger are partial; the other seven are not implemented.
- PR #54 remains Open / Draft / Not Merged.
- Five Staging migration SQL source files remain unresolved; path-specific GitHub history search found no matching commits.
- Android native project/APK, real SMTP/recovery proof, nine product vertical slices and independent AuthZ runtime testing remain unproven.
- No Staging or Production DB/Auth/Storage/Edge Function mutation was made by this decision.

## 3. Orders to the technical committee

### Order 1 — Protect what already works
Preserve the React/TypeScript/Vite shell, product registry, Arabic RTL/dark-light foundation, secure Staging profile projection, private Storage buckets and existing Messenger tests. No broad refactor is allowed unless a test or evidence identifies the need. Every replacement must maintain the existing acceptance suite.

### Order 2 — Start all nine product tracks, but do not scatter implementation
Each product receives a named accountable owner, module boundary, user stories, schema/API contract, threat model, acceptance checklist and isolated feature branch. This is mandatory for all nine tracks immediately.
- FB and Messenger: highest implementation priority. Close their real end-to-end flows and access-control gaps.
- Twitty, Insta and WHATSMYGRAM: parallel domain design and bounded slices against shared social/media/messaging contracts. WHATSMYGRAM retains a distinct phone identity/consent boundary; it is not a Messenger rename.
- Meeting, Tube and TikToks: parallel technical designs and proof-of-concept slices for SFU/video, media processing/transcoding/CDN, capacity, moderation and unit cost. No production-scale promises before capacity tests and provider decisions.
- AI: secure provider adapter, server-only keys, data/privacy controls, usage quotas and cost model. Do not activate a paid provider without explicit authorization.

### Order 3 — Establish platform services before duplication
Define versioned shared contracts for identity/profile, social graph, messaging/realtime, media, notifications, search, moderation, localization and audit/telemetry. Products consume these services; no duplicate auth, media-upload or authorization implementations. Keep Wallet/payment/subscriptions out of preview scope unless separately authorized.

### Order 4 — Split execution lanes without overlapping ownership
A. Migration integrity, identity, membership and RLS/AuthZ.
B. Android native project and build pipeline.
C. FB and Messenger vertical slices.
D. Social/media vertical slices: Twitty and Insta, then WHATSMYGRAM once phone identity dependencies are approved.
E. Media/communications/AI architecture and bounded proofs: Meeting, Tube, TikToks and AI.
F. Independent test engineering, localization automation and release evidence.

Lanes may progress in parallel when file/schema ownership is distinct. One integrator alone advances `rebuild/phase-a-architecture`; no simultaneous pushes to the same branch and no overlapping edits to migrations/components. Product branches integrate serially and CI runs on the merged integration commit.

### Order 5 — Resolve the critical security path without freezing independent work
- Continue trusted recovery of five missing Staging migrations. Do not invent SQL, reset Staging or rewrite migration history.
- Prepare membership schema and signup-gate design; preserve `on_auth_user_created`/`handle_new_user()`.
- Replace the permissive Staging feed SELECT policies rather than adding an OR-combined permissive policy.
- Enforce preview membership in Messenger, Storage and Realtime while retaining owner/participant checks.
- Correct and harden `qa-authz-two-user`; execute it independently with real A/B/C JWTs only after OIDC trust and server-side fixture setup are reviewed.
- Import no tester addresses and distribute no APK until Gate A, independent human review and owner authorization pass.

### Order 6 — Build Android in parallel
Proceed with pinned Capacitor 8, local assets, Staging application ID, strict Staging URL guard, no remote shell, no Service Role/Secret in client assets, Auth deep links, password recovery, Gradle CI, signature/package/permissions checks, checksum and physical-device owner test. No APK is claimed until an artifact exists and is installed on a real device.

### Order 7 — Product acceptance before percent promotion
A product advances only when its real workflow persists data, enforces permissions, has negative tests, works on target devices and has evidence linked to the exact SHA. Product descriptions, screens, schemas or mock responses alone do not move status to acceptance-passed.

### Order 8 — Independent security and Production boundary
A human independent reviewer, not the implementer, reviews sensitive SQL/Auth/RLS/Storage/Realtime and release evidence. Prepare the Production profile privacy fix as a Staging-tested proposal only. Production remains read-only until a separate explicit authorization.

## 4. Measurement and score governance

Adopt [PRODUCT-DELIVERY-SCORECARD.md](PRODUCT-DELIVERY-SCORECARD.md) as the one scoring contract:
- Overall readiness: 15% shared platform + 45% average of nine products + 15% integration + 15% security/quality + 10% release/operations.
- Product readiness: 30% end-to-end journey, 15% data/API, 20% authorization/privacy, 10% UX/accessibility, 15% automated tests/failure paths, 10% operations/performance.
- Every criterion receives 0/50/100 only with evidence rules. Keep the neutral 30% as a historical estimate until an evidence-based baseline is fully populated.
- Report each product's score separately from release eligibility. Hard blockers cannot be averaged away.

## 5. Mandatory weekly output and immediate reporting

For every stream, report: owner; issue; branch; exact SHA; files/schema objects changed; acceptance tests; CI link; Staging result; rollback; reviewer; blockers and next output. Show daily movement by closed acceptance criteria, not lines of code or number of commits.

No unsupported completion estimates. No task can stay marked "in progress" without a named next verifiable output. Any task blocked by external provider, source provenance or owner approval must produce its technical decision record and a parallel non-blocked task.

## 6. Release gates

- **Gate A — preview security:** invite/signup, capacity, expiry/revocation, feed RLS, profiles, Messenger, Storage, Realtime, independent AuthZ A/B/C and cleanup all pass.
- **Gate B — client integrity:** reproducible Staging-only APK, secret scan, Auth callback/recovery and owner physical-device acceptance.
- **Gate C — controlled tester preview:** A and B pass; independent human security review; owner approval; invitation roster import and manual acceptance.
- **Production:** separate plan, Staging validation, human security review, rollback evidence and separate authorization.

A higher progress score does not override a failed release gate.

---
*Decision 12 is a delivery and measurement order. It does not claim that the nine products have been implemented or that any Supabase environment has been changed.*
