import assert from "node:assert/strict";
import test from "node:test";

import { StructuredToolError } from "../src/errors.ts";
import { createErrorToolResult } from "../src/results.ts";

test("createErrorToolResult preserves structured payloads", () => {
  const payload = {
    error: "blocked_command",
    message: "WP-CLI eval is blocked.",
    policyCode: "wp_cli_eval_blocked",
  };
  const result = createErrorToolResult(new StructuredToolError(payload));

  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, payload);
  assert.equal(result.content[0]?.type, "text");
  assert.match(result.content[0]?.text || "", /wp_cli_eval_blocked/);
});
