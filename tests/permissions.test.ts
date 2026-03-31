import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAllowedWpFlags,
  assertWpCliPermissionsForProfile,
} from "../src/permissions.ts";

test("assertAllowedWpFlags blocks site-selection flags handled by the MCP", () => {
  assert.throws(() => assertAllowedWpFlags(["plugin", "list", "--path=/tmp/site"]));
});

test("safe profile allows inspection commands", () => {
  assert.doesNotThrow(() =>
    assertWpCliPermissionsForProfile("safe", ["plugin", "list"]),
  );
});

test("safe profile blocks write commands", () => {
  assert.throws(() =>
    assertWpCliPermissionsForProfile("safe", ["option", "update", "home", "https://example.com"]),
  );
});

test("full-access profile allows non-destructive writes", () => {
  assert.doesNotThrow(() =>
    assertWpCliPermissionsForProfile("full-access", ["option", "update", "home", "https://example.com"]),
  );
});

test("full-access profile allows destructive site commands", () => {
  assert.doesNotThrow(() =>
    assertWpCliPermissionsForProfile("full-access", ["plugin", "delete", "hello-dolly"]),
  );
});

test("safe profile only allows search-replace in dry-run mode", () => {
  assert.throws(() =>
    assertWpCliPermissionsForProfile("safe", ["search-replace", "old", "new"]),
  );
  assert.doesNotThrow(() =>
    assertWpCliPermissionsForProfile("safe", ["search-replace", "old", "new", "--dry-run"]),
  );
});

test("full-access profile still blocks arbitrary execution commands", () => {
  assert.throws(() =>
    assertWpCliPermissionsForProfile("full-access", ["eval", "echo 1;"]),
  );
  assert.doesNotThrow(() =>
    assertWpCliPermissionsForProfile("full-access", ["plugin", "delete", "hello-dolly"]),
  );
});
