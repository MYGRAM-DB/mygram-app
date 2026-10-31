import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_VERSION,
  validateCursor,
  assertResourceOwner,
} from "../../src/lib/workshops/contracts.mjs";

test("platform cursor contract uses the verified created_at + id keyset", () => {
  assert.equal(CONTRACT_VERSION, "1.0.1");
  const cursor = {
    before: { created_at: "2026-10-30T10:00:00.000Z", id: "message-001" },
    limit: 50,
  };
  assert.deepEqual(validateCursor(cursor), cursor);
  assert.deepEqual(validateCursor({ before: null, limit: 50 }), { before: null, limit: 50 });
  assert.throws(() => validateCursor({ before: null, limit: 101 }), /INVALID_PAGE_LIMIT/);
  assert.throws(() => validateCursor({
    before: { created_at: "not-a-date", id: "message-001" },
    limit: 50,
  }), /INVALID_CURSOR/);
  assert.throws(() => validateCursor({
    before: { created_at: "2026-10-30T10:00:00.000Z", id: "" },
    limit: 50,
  }), /INVALID_CURSOR/);
});

test("platform ownership rejects mismatched owner", () => {
  assert.doesNotThrow(() => assertResourceOwner("media", "platform-media"));
  assert.throws(() => assertResourceOwner("identity", "messenger"), /RESOURCE_OWNER_MISMATCH/);
});
