import assert from "node:assert/strict";
import test from "node:test";
import { isValidUsername, normalizeUsername } from "../src/lib/profile-validation.js";

test("username normalization trims spaces and lowercases Latin letters", () => {
  assert.equal(normalizeUsername("  LoAi_92  "), "loai_92");
});

test("username validation accepts the supported ASCII format", () => {
  assert.equal(isValidUsername("abc"), true);
  assert.equal(isValidUsername("mygram_user_92"), true);
  assert.equal(isValidUsername("user123"), true);
});

test("username validation rejects values outside 3 to 30 characters", () => {
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("a".repeat(31)), false);
});

test("username validation rejects spaces, punctuation and non-ASCII characters", () => {
  assert.equal(isValidUsername("two words"), false);
  assert.equal(isValidUsername("user-name"), false);
  assert.equal(isValidUsername("اسم_مستخدم"), false);
});
