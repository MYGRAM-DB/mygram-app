import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const products = JSON.parse(await readFile(new URL("../src/config/products.json", import.meta.url), "utf8"));

test("the approved MYGRAM registry contains exactly nine products", () => {
  assert.equal(products.length, 9);
});
test("product identifiers and route slugs are unique", () => {
  assert.equal(new Set(products.map((p) => p.id)).size, products.length);
  assert.equal(new Set(products.map((p) => p.slug)).size, products.length);
});
test("each product has required metadata and explicit delivery status", () => {
  for (const p of products) {
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.match(p.slug, /^[a-z0-9-]+$/);
    assert.ok(p.name.length > 2);
    assert.ok(p.description.length > 10);
    assert.ok(["partial", "not-implemented"].includes(p.status));
  }
});
test("Messenger and WHATSMYGRAM remain independent products", () => {
  const messenger = products.find((p) => p.id === "messenger");
  const whatsmygram = products.find((p) => p.id === "whatsmygram");
  assert.ok(messenger && whatsmygram);
  assert.notEqual(messenger.slug, whatsmygram.slug);
});

test("only products with a working Staging workspace are marked partial", () => {
  assert.deepEqual(
    products.filter((p) => p.status === "partial").map((p) => p.id).sort(),
    ["fb", "messenger"],
  );
});
