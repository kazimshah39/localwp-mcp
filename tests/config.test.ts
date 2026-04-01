import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAccessProfile } from "../src/config.ts";

test("normalizeAccessProfile accepts safe", () => {
  assert.equal(normalizeAccessProfile("safe"), "safe");
});

test("normalizeAccessProfile accepts full-access aliases", () => {
  assert.equal(normalizeAccessProfile("full-access"), "full-access");
  assert.equal(normalizeAccessProfile("full_access"), "full-access");
  assert.equal(normalizeAccessProfile("full"), "full-access");
});

test("normalizeAccessProfile rejects invalid values", () => {
  assert.throws(() => normalizeAccessProfile("write"));
});
