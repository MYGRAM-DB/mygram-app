import test from "node:test";import assert from "node:assert/strict";import {addReply,editOwnedPost} from "../../src/lib/workshops/fb.mjs";
test("nested reply and missing-parent rejection",()=>{const rows=[{id:"c1"}];assert.equal(addReply(rows,"c1",{id:"c2",parentId:"c1",body:" reply "})[1].body,"reply");assert.throws(()=>addReply(rows,"x",{id:"c3",parentId:"x",body:"x"}),/PARENT_NOT_FOUND/)});
test("only owner edits a post",()=>{const p={authorId:"a",body:"old"};assert.equal(editOwnedPost(p,"a","new").body,"new");assert.throws(()=>editOwnedPost(p,"b","hack"),/FORBIDDEN/)})

test("post cursor merge orders by created_at and id and deduplicates overlapping pages", () => {
  const older = { id: "00000000-0000-4000-8000-000000000001", created_at: "2026-10-30T08:00:00.000Z", body: "older" };
  const tiedA = { id: "00000000-0000-4000-8000-000000000002", created_at: "2026-10-30T10:00:00.000Z", body: "tied-a" };
  const tiedB = { id: "00000000-0000-4000-8000-000000000003", created_at: "2026-10-30T10:00:00.000Z", body: "tied-b" };
  const latest = { id: "00000000-0000-4000-8000-000000000004", created_at: "2026-10-30T11:00:00.000Z", body: "latest" };

  const merged = mergePostsByCreatedAtId([latest, tiedB], [tiedB, tiedA, older]);
  assert.deepEqual(merged.map((post) => post.id), [latest.id, tiedB.id, tiedA.id, older.id]);
  assert.equal(new Set(merged.map((post) => post.id)).size, 4);
});

test("post cursor merge rejects invalid timestamps", () => {
  assert.throws(
    () => mergePostsByCreatedAtId([], [{ id: "post", created_at: "invalid" }]),
    /INVALID_POST_CURSOR/,
  );
});
