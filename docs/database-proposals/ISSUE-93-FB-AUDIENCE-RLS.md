# Database / Security proposal — Issue #93
## First-release FB post audience and inherited comment visibility

**Status:** Product semantics recovered from approved Decision 15; schema/RLS implementation remains proposal-only. No migration SQL file generated or applied. No Staging or Production write occurred.

**Environment inspected:** MYGRAM-STAGING, project ref `cbyvtehvaojxfcgpelir`, read-only inspection on 2026-10-31.

## 1. Approved product contract recovered

Source: `docs/DECISION-15-FEED-VISIBILITY-AND-GATE-A.md`.

| Object | Approved first-release visibility |
|---|---|
| Public post | All authenticated MYGRAM accounts |
| Private post | Owner only |
| Comment | Exactly the parent post's visibility |
| Nested comment | Root post visibility |
| Reaction | Exactly the parent post's visibility |
| Friends-only | Deferred until friendship/blocking authorization exists |
| Anonymous visitor | No feed table access |

New posts default to **Private**. “Public” means authenticated MYGRAM accounts only, not anonymous access, public storage, or search-engine access. Existing posts must be backfilled Private unless a separately reviewed owner decision says otherwise.

## 2. Fresh read-only Staging evidence

| Check | Result |
|---|---|
| `posts` columns | No `visibility`, `audience` or `privacy` column |
| `posts_select_authenticated` | PERMISSIVE SELECT, role authenticated, `USING (true)` |
| `post_comments_select_authenticated` | PERMISSIVE SELECT, role authenticated, `USING (true)` |
| `post_reactions_select_authenticated` | PERMISSIVE SELECT, role authenticated, `USING (true)` |
| Public tables | 15 base tables, all RLS enabled |
| Public views | 1 |
| Public policies | 32 |
| `posts` rows at snapshot | 0 |
| `post_comments` rows at snapshot | 0 |
| `post_reactions` rows at snapshot | 0 |

Postgres permissive policies are OR-combined. Adding a restrictive-looking new permissive policy beside the current `USING (true)` policies would not narrow access.

## 3. Proposed schema contract (candidate naming only)

Candidate column: `posts.visibility`, constrained to `public` / `private`, NOT NULL, default `private`.

The name must be confirmed by W1 and Database against all consumers before it becomes authoritative. No code or migration may assume this candidate until that review.

Existing rows must be explicitly backfilled to `private`; the migration must not use a default that makes existing posts public. Missing, invalid or unsupported values fail closed.

## 4. Policy design principles

The migration must **replace/narrow** the three broad SELECT policies, not add a fourth policy.

- Posts SELECT: owner may read own posts; another authenticated account may read only `visibility = 'public'`.
- Comments SELECT: visible only when an authorized parent post is visible to the caller. Nested replies inherit the root post's audience.
- Reactions SELECT: visible only when the associated post is visible to the caller.
- Comment/reaction INSERT: require authorization to view the parent post; a child row cannot widen its parent's audience.
- Post UPDATE: owner-only with both `USING` and `WITH CHECK`; only owner may change visibility.
- Anonymous role: no feed table access.
- No friends-only branch until friendship/blocking relations and policies are separately designed and tested.

Avoid recursive RLS policy dependencies. If a helper function is proposed, review SECURITY INVOKER/DEFINER behavior, fixed search_path, grants, identity derivation and recursion safety before use.

## 5. Mandatory tests

Use three independent real Auth users A/B/C and actual PostgREST requests:
- A reads own Private and Public posts.
- B/C can read A's Public post.
- B/C cannot read A's Private post by ID or feed listing.
- B/C cannot infer private content through comments, nested comments, reactions, counts, search or Realtime.
- Comments/reactions on a Public post remain readable according to the contract.
- A changes Public to Private; subsequent B/C reads and Realtime events are denied.
- Invalid/missing visibility fails closed.
- Anonymous client cannot read feed tables.
- All fixture rows, objects and Auth users are removed and independently verified absent.

The tests must exercise API and live JWT authorization, not only SQL policy expressions or browser-side filtering.

## 6. Migration and rollback boundary

No migration file has been generated. Before any future Staging application:
1. Complete the five missing historical migration source reconciliation or approve a baseline exception.
2. Repeat the preflight and record exact row counts immediately before applying.
3. Attach before/after schema and policy matrices, source SHA-256, CI evidence, A/B/C runtime results, lock impact, and owner/security approvals.
4. Preserve RLS and all private Storage boundaries.

Rollback must not restore the three broad `USING (true)` policies. If the new feed path must be disabled, keep owner-only access or disable the feed route until a reviewed safe policy is restored. Never compensate by widening access.

## 7. Owners / dependencies

- W1: confirm client contract, visibility selector, default and behavior for comments/reactions.
- Database: produce exact migration source after source reconciliation and schema review.
- Security: review policy OR-composition, API denial, Realtime and side-channel coverage.
- W10: update shared TypeScript contracts only after the column is approved and source is authoritative.
- CI: require schema/policy tests and exact-SHA evidence.
- Project owner: approve the final product contract and any protected Staging execution separately.

**Decision:** Decision 15 supplies the authoritative Public/Private semantics. #93 remains OPEN because the database does not yet enforce them. This document is a proposal, not an applied migration, runtime acceptance, or release authorization.
