import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLogScope } from "../src/logs.ts";

test("normalizeLogScope accepts canonical values", () => {
  assert.equal(normalizeLogScope(undefined), "site");
  assert.equal(normalizeLogScope("site"), "site");
  assert.equal(normalizeLogScope("global"), "global");
  assert.equal(normalizeLogScope("all"), "all");
});

test("normalizeLogScope accepts friendly aliases", () => {
  assert.equal(normalizeLogScope("both"), "all");
  assert.equal(normalizeLogScope("combined"), "all");
});

test("normalizeLogScope rejects unknown values", () => {
  assert.throws(() => normalizeLogScope("everything"));
});
