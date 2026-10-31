# Issue #95 proposal: same-post nested-comment integrity

**Status:** Design proposal only. Not an executable migration.  
**Target:** MYGRAM-STAGING after database/security review and explicit approval.  
**Production:** Read-only.  
**Owner:** Database / Security, coordinated with W1 FB.

## Verified starting point

The reviewed Staging migration source creates `post_comments.parent_comment_id` with a single-column self-reference to `post_comments(id)` and `ON DELETE CASCADE`. That verifies parent existence but not that parent and child share the same `post_id`.

This proposal intentionally does not choose or alter the post audience model. Issue #93 remains separate and blocking for Public/Private.

## Required preflight (must run before DDL)

Run read-only checks and stop if either query returns rows:

```sql
-- Cross-post parent links.
SELECT child.id AS child_comment_id,
       child.post_id AS child_post_id,
       parent.id AS parent_comment_id,
       parent.post_id AS parent_post_id
FROM public.post_comments AS child
JOIN public.post_comments AS parent
  ON parent.id = child.parent_comment_id
WHERE child.post_id <> parent.post_id;

-- Direct self-parent links.
SELECT id, post_id
FROM public.post_comments
WHERE parent_comment_id = id;
```

No row may be deleted or silently rewritten to make the migration pass. Any returned rows require an owner-approved data repair plan and separate evidence.

## Proposed constraint sequence

The following is a review draft, not approved for execution. Confirm exact constraint names, table definition, indexes, nullability and lock impact against current Staging before preparing a versioned migration.

```sql
BEGIN;

-- Required as the referenced composite key for the same-post FK.
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_id_post_id_key
  UNIQUE (id, post_id);

-- Add as NOT VALID so existing rows are checked explicitly at validation.
-- ON DELETE CASCADE preserves the currently recorded parent-delete behavior.
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_parent_same_post_fkey
  FOREIGN KEY (parent_comment_id, post_id)
  REFERENCES public.post_comments (id, post_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.post_comments
  VALIDATE CONSTRAINT post_comments_parent_same_post_fkey;

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_no_self_parent_check
  CHECK (parent_comment_id IS NULL OR parent_comment_id <> id)
  NOT VALID;

ALTER TABLE public.post_comments
  VALIDATE CONSTRAINT post_comments_no_self_parent_check;

-- Drop only after the composite FK has been validated and reviewed.
ALTER TABLE public.post_comments
  DROP CONSTRAINT post_comments_parent_comment_id_fkey;

COMMIT;
```

Before execution, verify whether a unique constraint on `(id, post_id)` is redundant or can be safely reused, and assess index build/locking behavior for the actual table size. The composite FK must retain the intended delete semantics; do not assume the old constraint name without inspecting `pg_constraint`.

## Rollback draft

If the composite constraint causes an unexpected application or integrity issue, restore the prior single-column FK before removing the composite FK:

```sql
BEGIN;

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_parent_comment_id_fkey
  FOREIGN KEY (parent_comment_id)
  REFERENCES public.post_comments (id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.post_comments
  VALIDATE CONSTRAINT post_comments_parent_comment_id_fkey;

ALTER TABLE public.post_comments
  DROP CONSTRAINT post_comments_parent_same_post_fkey;

ALTER TABLE public.post_comments
  DROP CONSTRAINT post_comments_no_self_parent_check;

ALTER TABLE public.post_comments
  DROP CONSTRAINT post_comments_id_post_id_key;

COMMIT;
```

Rollback restores the old weaker integrity rule. It is a recovery mechanism, not an acceptable final state for Issue #95.

## Acceptance tests required

1. Root comment with `parent_comment_id IS NULL` inserts successfully.
2. Reply to a parent on the same post inserts and survives reload.
3. Reply using a parent from another post is rejected by PostgreSQL through direct REST.
4. Direct self-parenting is rejected.
5. Deleting a parent preserves the existing intended cascade behavior for descendants.
6. Preflight returns zero rows before and after migration.
7. Schema inspection confirms both constraints and their validation state.
8. Existing comments remain unchanged.
9. Browser E2E proves root → reply → nested reply → reload.
10. A/B/C visibility tests remain independently required by #60 and #93.

## Approval gates

- Database owner reviews the DDL, exact constraint names and lock/impact assessment.
- Security owner reviews RLS interaction and direct REST rejection.
- W1 owner reviews UI behavior and deletion semantics.
- CI runs migration/static tests on the exact proposal SHA.
- Only after written approval may a Staging-only migration be created/applied.
- No Production migration or write is authorized.
