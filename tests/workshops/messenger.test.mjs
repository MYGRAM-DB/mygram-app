import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeMessagesByCreatedAtId,
  attachmentTransition,
} from "../../src/lib/workshops/messenger.mjs";

test("failed attachments can retry; uploaded cannot regress", () => {
  assert.equal(attachmentTransition("failed", "queued"), "queued");
  assert.throws(() => attachmentTransition("uploaded", "queued"), /INVALID_ATTACHMENT_TRANSITION/);
});

test("created_at and id cursor merge is stable and deduplicates overlapping pages", () => {
  const older = {
    id: "00000000-0000-4000-8000-000000000001",
    created_at: "2026-10-30T10:00:00.000Z",
    body: "older",
  };
  const newer = {
    id: "00000000-0000-4000-8000-000000000002",
    created_at: "2026-10-30T10:00:00.000Z",
    body: "newer",
  };
  const latest = {
    id: "00000000-0000-4000-8000-000000000003",
    created_at: "2026-10-30T11:00:00.000Z",
    body: "latest",
  };

  const merged = mergeMessagesByCreatedAtId([latest], [newer, older, latest]);
  assert.deepEqual(merged.map((message) => message.id), [older.id, newer.id, latest.id]);
});

test("created_at and id cursor rejects invalid timestamp", () => {
  assert.throws(
    () => mergeMessagesByCreatedAtId([], [{ id: "x", created_at: "not-a-date" }]),
    /INVALID_MESSAGE_CURSOR/,
  );
});
