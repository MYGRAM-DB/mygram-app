# Database proposal — Issue #95
## Enforce same-post parent integrity for nested comments

**Status:** Design proposal only. No migration SQL file has been generated, committed or applied. No Staging or Production write occurred.

**Environment inspected:** MYGRAM-STAGING, project ref `cbyvtehvaojxfcgpelir`, read-only inspection on 2026-10-31.

## 1. Verified current schema

| Item | Live Staging evidence |
|---|---|
| `post_comments` rows | 0 at inspection time |
| Primary key | `id` |
| Parent link | `parent_comment_id uuid` |
| Existing parent FK | `post_comments_parent_comment_id_fkey`: `parent_comment_id -> post_comments.id` |
| Existing parent delete rule | `ON DELETE CASCADE` |
| Existing indexes | PK `id`; `parent_comment_id`; `(post_id, created_at)`; `user_id` |
| Composite unique key | No `(id, post_id)` unique key found |
| Preflight nested rows | 0 |
| Preflight self-parent rows | 0 |
| Preflight cross-post parent rows | 0 |

The zero-row preflight is a dated snapshot only. It must be repeated immediately before any approved migration.

## 2. Required invariant

For every non-root comment, the referenced parent must belong to the same post:

`child.parent_comment_id IS NULL OR EXISTS(parent WHERE parent.id = child.parent_comment_id AND parent.post_id = child.post_id)`

Root comments with `parent_comment_id IS NULL` remain valid. Deleting a parent comment must preserve the current cascade contract.

## 3. Proposed migration sequence (not executable authorization)

1. Run a preflight query that counts cross-post references and direct self-parent references. Abort if either count is non-zero. Do not delete or rewrite rows.
2. Add a unique key on `(id, post_id)` to support the composite FK target. Assess lock duration and index strategy against the migration runner; do not assume `CREATE INDEX CONCURRENTLY` is allowed inside its transaction.
3. Add the composite self-FK:
   `(parent_comment_id, post_id) REFERENCES public.post_comments(id, post_id) ON DELETE CASCADE`.
4. Add a direct-self-parent CHECK:
   `parent_comment_id IS NULL OR parent_comment_id <> id`.
5. Validate the composite FK before dropping the existing single-column parent FK. Preserve the current cascade behavior.
6. Define longer-cycle behavior explicitly. **Proposed decision: longer cycles are forbidden**, because recursive comment rendering and parent traversal must remain a tree. A reviewed trigger/constraint strategy must reject a new parent assignment when the proposed parent chain already reaches the child ID. The composite FK alone does not prevent longer cycles.
7. Re-run schema, constraint, index and policy checks. No unrelated audience/privacy or RLS change belongs in this migration.

### Conceptual DDL shape

```sql
-- Design sketch only; not a migration file and not approved for execution.
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_id_post_id_key UNIQUE (id, post_id);

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_parent_same_post_fkey
  FOREIGN KEY (parent_comment_id, post_id)
  REFERENCES public.post_comments (id, post_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.post_comments
  VALIDATE CONSTRAINT post_comments_parent_same_post_fkey;

-- Only after successful validation:
ALTER TABLE public.post_comments
  DROP CONSTRAINT post_comments_parent_comment_id_fkey;
```

The direct-self CHECK and cycle-prevention trigger are also required before acceptance. The final migration must be generated with the approved Supabase CLI, reviewed by Database and Security, and include exact pre/post checks.

## 4. Acceptance tests

- Root comment with NULL parent persists.
- Same-post reply persists.
- Cross-post parent is rejected at database level, including direct PostgREST.
- Direct self-parent is rejected.
- Longer cycle is rejected.
- Parent deletion follows the existing cascade contract.
- Existing rows pass the immediate preflight.
- No row is silently rewritten or deleted.
- Test cleanup and database absence are independently verified.

## 5. Rollback / compensation

Rollback must not widen access or silently restore inconsistent rows. If the new composite constraint must be removed after application:
1. Recreate and validate the old single-column FK with `ON DELETE CASCADE`.
2. Drop the composite FK and cycle/self-parent enforcement only after the old FK is valid.
3. Drop the composite unique key only after confirming no dependent constraint uses it.
4. Keep the application path disabled or fail closed until the integrity invariant is restored. Preserve all rows.

## 6. Dependencies and blockers

- Database owner: generate the migration through the approved CLI, inspect lock impact, and attach source SHA-256.
- Security owner: review direct REST denial and trigger privileges/search_path.
- W1 owner: confirm UI and recursive renderer behavior for cycle rejection.
- CI owner: add migration proposal validation to the appropriate workflow.
- Issue #93 feed audience/privacy is a separate P0 and must not be mixed into this migration.
- Five historical migration SQL sources remain missing; no migration is to be applied until the source-of-truth reconciliation or approved baseline exception is complete.

**Decision:** #95 remains OPEN. This document is a review proposal, not a migration, runtime test, acceptance certificate, or permission to mutate Staging.
