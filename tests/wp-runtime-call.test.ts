import assert from "node:assert/strict";
import test from "node:test";

import { resolveWpRuntimeCallProcessResult } from "../src/tools/wp-runtime-call.ts";

test("resolveWpRuntimeCallProcessResult recovers a runtime payload from a nonzero WP-CLI exit", () => {
  const stdout = [
    "notice before payload",
    "LOCALWP_MCP_JSON_START",
    JSON.stringify({
      ok: true,
      callType: "function",
      callable: "wp_get_theme",
      args: [],
      rawResultType: "string",
      rawResult: "Hello Elementor",
      readOnlyState: {
        blockedSideEffects: [],
        blockedSqlVerbs: [],
        blockedSqlCount: 0,
        blockedHttpCount: 0,
        blockedMailCount: 0,
        writesBlocked: false,
        sideEffectsPrevented: false,
        transactionStarted: true,
        transactionRolledBack: true,
        transactionCommitted: false,
      },
    }),
    "LOCALWP_MCP_JSON_END",
  ].join("\n");

  const resolved = resolveWpRuntimeCallProcessResult(
    {
      site: {
        name: "example-site",
      },
    } as never,
    {
      exitCode: 255,
      stdout,
      stderr: "warning emitted after payload",
      timedOut: false,
    },
  );

  assert.equal(resolved.parsed.payload.callable, "wp_get_theme");
  assert.equal(
    resolved.wpCliStatus,
    "payload_recovered_from_nonzero_exit",
  );
  assert.match(resolved.wpCliWarning || "", /code 255/);
  assert.match(resolved.wpCliWarning || "", /warning emitted after payload/);
});

test("resolveWpRuntimeCallProcessResult still throws when no payload is present", () => {
  assert.throws(() =>
    resolveWpRuntimeCallProcessResult(
      {
        site: {
          name: "example-site",
        },
      } as never,
      {
        exitCode: 255,
        stdout: "",
        stderr: "fatal error",
        timedOut: false,
      },
    ),
  );
});
