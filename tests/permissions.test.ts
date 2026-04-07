import assert from "node:assert/strict";
import test from "node:test";

import { StructuredToolError } from "../src/errors.ts";
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

test("blocked eval commands return structured policy details", () => {
  assert.throws(
    () => assertWpCliPermissionsForProfile("full-access", ["eval", "echo 1;"]),
    (error) => {
      assert.ok(error instanceof StructuredToolError);
      assert.equal(error.payload.error, "blocked_command");
      assert.equal(error.payload.policyCode, "wp_cli_eval_blocked");
      assert.equal(error.payload.blockedFeature, "eval");
      assert.deepEqual(error.payload.args, ["eval", "echo 1;"]);
      assert.deepEqual(error.payload.suggestedAlternatives, [
        "execute_wp_php_readonly for protected runtime snippets",
        "execute_wp_php in full-access",
        "execute_wp_cli with standard WP-CLI commands",
        "mysql_query for read-only SQL inspection",
      ]);
      return true;
    },
  );
});

test("blocked site-selection flags return structured policy details", () => {
  assert.throws(
    () => assertAllowedWpFlags(["plugin", "list", "--path=/tmp/site"]),
    (error) => {
      assert.ok(error instanceof StructuredToolError);
      assert.equal(error.payload.policyCode, "wp_cli_site_selection_flag_blocked");
      assert.equal(error.payload.blockedFeature, "--path");
      return true;
    },
  );
});

test("dangerous bootstrap flags are blocked with structured details", () => {
  assert.throws(
    () => assertAllowedWpFlags(["--require=/tmp/bootstrap.php", "plugin", "list"]),
    (error) => {
      assert.ok(error instanceof StructuredToolError);
      assert.equal(error.payload.policyCode, "wp_cli_require_flag_blocked");
      assert.equal(error.payload.blockedFeature, "--require");
      assert.match(String(error.payload.reason), /arbitrary PHP/);
      assert.deepEqual(error.payload.suggestedAlternatives, [
        "Use execute_wp_php_readonly for protected runtime snippets.",
        "Use execute_wp_php for high-trust runtime PHP.",
        "Use wp_call_function or wp_call_static_method for read-oriented runtime inspection.",
      ]);
      return true;
    },
  );

  assert.throws(
    () => assertAllowedWpFlags(["--exec=echo 1;", "plugin", "list"]),
    (error) => {
      assert.ok(error instanceof StructuredToolError);
      assert.equal(error.payload.policyCode, "wp_cli_exec_flag_blocked");
      assert.equal(error.payload.blockedFeature, "--exec");
      return true;
    },
  );
});
