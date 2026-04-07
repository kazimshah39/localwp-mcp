import assert from "node:assert/strict";
import os from "os";
import path from "path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";

import {
  assertPhpClassIdentifier,
  assertPhpFunctionIdentifier,
  assertPhpMethodIdentifier,
  describeReadOnlyRuntimeOutcome,
  extractWpReadonlyPhpPayload,
  extractWpRuntimeCallPayload,
  normalizeInlinePhpCode,
  parseWpRuntimeArgsJson,
  prepareWpPhpSource,
  prepareReadonlyWpPhpExecutionFiles,
  prepareWpRuntimeCallFiles,
  resolveReadOnlyRuntimeResult,
  resolveTrustedWpPhpFilePath,
} from "../src/wp-runtime.ts";

test("normalizeInlinePhpCode prepends an opening tag when needed", () => {
  assert.equal(
    normalizeInlinePhpCode("echo 'hello';"),
    "<?php\necho 'hello';\n",
  );
});

test("normalizeInlinePhpCode preserves tagged snippets", () => {
  assert.equal(
    normalizeInlinePhpCode("<?php\necho 'hello';\n"),
    "<?php\necho 'hello';\n",
  );
});

test("parseWpRuntimeArgsJson defaults to an empty array", () => {
  assert.deepEqual(parseWpRuntimeArgsJson(undefined), []);
});

test("parseWpRuntimeArgsJson requires a JSON array", () => {
  assert.throws(() => parseWpRuntimeArgsJson("{\"id\":1}"));
  assert.deepEqual(parseWpRuntimeArgsJson("[1,\"two\",true]"), [1, "two", true]);
});

test("PHP callable identifier validators reject unsafe names", () => {
  assert.doesNotThrow(() => assertPhpFunctionIdentifier("Vendor\\debug_helper"));
  assert.doesNotThrow(() => assertPhpClassIdentifier("Vendor\\WebhookService"));
  assert.doesNotThrow(() => assertPhpMethodIdentifier("discoverFields"));
  assert.throws(() => assertPhpFunctionIdentifier("debug-helper"));
  assert.throws(() => assertPhpClassIdentifier("../WebhookService"));
  assert.throws(() => assertPhpMethodIdentifier("discover-fields"));
});

test("prepareWpPhpSource writes inline snippets to a temp php file", async () => {
  const tempSiteRoot = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-runtime-site-"),
  );
  let cleanupPath: string | null = null;

  try {
    const source = await prepareWpPhpSource({
      siteRoot: tempSiteRoot,
      phpCode: "echo 'hello';",
      cwd: tempSiteRoot,
    });

    assert.equal(source.mode, "inline");
    assert.equal(source.sourcePath, null);
    assert.ok(source.cleanupPath);
    assert.equal(path.extname(source.absolutePath), ".php");
    cleanupPath = source.cleanupPath;
  } finally {
    if (cleanupPath) {
      await rm(cleanupPath, { recursive: true, force: true });
    }
    await rm(tempSiteRoot, { recursive: true, force: true });
  }
});

test("resolveTrustedWpPhpFilePath allows scripts inside the working directory", async () => {
  const tempSiteRoot = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-runtime-site-"),
  );
  const tempWorkspace = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-runtime-workspace-"),
  );
  const scriptPath = path.join(tempWorkspace, "inspect.php");

  try {
    await writeFile(scriptPath, "<?php\necho 'ok';\n", "utf8");

    const resolved = await resolveTrustedWpPhpFilePath(
      tempSiteRoot,
      scriptPath,
      {
        cwd: tempWorkspace,
      },
    );

    assert.equal(resolved, scriptPath);
  } finally {
    await rm(tempSiteRoot, { recursive: true, force: true });
    await rm(tempWorkspace, { recursive: true, force: true });
  }
});

test("resolveTrustedWpPhpFilePath rejects files outside the site and workspace", async () => {
  const tempSiteRoot = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-runtime-site-"),
  );
  const tempWorkspace = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-runtime-workspace-"),
  );
  const outsideRoot = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-runtime-outside-"),
  );
  const scriptPath = path.join(outsideRoot, "inspect.php");

  try {
    await writeFile(scriptPath, "<?php\necho 'nope';\n", "utf8");

    await assert.rejects(
      () =>
        resolveTrustedWpPhpFilePath(tempSiteRoot, scriptPath, {
          cwd: tempWorkspace,
        }),
      /must live inside the selected Local site or the MCP working directory/,
    );
  } finally {
    await rm(tempSiteRoot, { recursive: true, force: true });
    await rm(tempWorkspace, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test("prepareWpRuntimeCallFiles creates guard and call scripts", async () => {
  const files = await prepareWpRuntimeCallFiles({
    callType: "function",
    functionName: "wp_get_theme",
    args: [],
  });

  try {
    assert.match(files.guardPath, /read-only-guard\.php$/);
    assert.match(files.scriptPath, /call\.php$/);
  } finally {
    await rm(files.cleanupPath, { recursive: true, force: true });
  }
});

test("prepareReadonlyWpPhpExecutionFiles creates guard and wrapper scripts", async () => {
  const tempSiteRoot = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-runtime-site-"),
  );

  try {
    const files = await prepareReadonlyWpPhpExecutionFiles({
      siteRoot: tempSiteRoot,
      phpCode: "echo 'ok';",
      cwd: tempSiteRoot,
    });

    assert.match(files.guardPath, /read-only-guard\.php$/);
    assert.match(files.scriptPath, /execute-readonly\.php$/);
    assert.equal(files.sourceMode, "inline");
    assert.equal(files.sourcePath, null);
    assert.equal(files.cleanupPaths.length, 2);

    for (const cleanupPath of files.cleanupPaths) {
      await rm(cleanupPath, { recursive: true, force: true });
    }
  } finally {
    await rm(tempSiteRoot, { recursive: true, force: true });
  }
});

test("extractWpRuntimeCallPayload parses marker-wrapped JSON and preserves extra stdout", () => {
  const stdout = [
    "debug line",
    "LOCALWP_MCP_JSON_START",
    JSON.stringify({
      ok: true,
      callType: "function",
      callable: "wp_get_theme",
      args: [],
      rawResultType: "string",
      rawResult: "theme",
      readOnlyState: {
        blockedSideEffects: ["sql_write"],
        blockedSqlVerbs: ["UPDATE"],
        blockedSqlCount: 1,
        blockedHttpCount: 0,
        blockedMailCount: 0,
        writesBlocked: true,
        sideEffectsPrevented: true,
        transactionStarted: true,
        transactionRolledBack: true,
        transactionCommitted: false,
      },
    }),
    "LOCALWP_MCP_JSON_END",
    "after line",
  ].join("\n");

  const parsed = extractWpRuntimeCallPayload(stdout);

  assert.equal(parsed.payload.callable, "wp_get_theme");
  assert.equal(parsed.payload.rawResult, "theme");
  assert.deepEqual(parsed.payload.readOnlyState, {
    blockedSideEffects: ["sql_write"],
    blockedSqlVerbs: ["UPDATE"],
    blockedSqlCount: 1,
    blockedHttpCount: 0,
    blockedMailCount: 0,
    writesBlocked: true,
    sideEffectsPrevented: true,
    transactionStarted: true,
    transactionRolledBack: true,
    transactionCommitted: false,
  });
  assert.equal(parsed.remainingStdout, "debug line\nafter line");
});

test("extractWpReadonlyPhpPayload parses marker-wrapped JSON and preserves extra stdout", () => {
  const stdout = [
    "notice line",
    "LOCALWP_MCP_JSON_START",
    JSON.stringify({
      ok: true,
      stdout: "{\"ok\":true}",
      rawResultType: "int",
      rawResult: 1,
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

  const parsed = extractWpReadonlyPhpPayload(stdout);

  assert.equal(parsed.payload.stdout, "{\"ok\":true}");
  assert.equal(parsed.payload.rawResultType, "int");
  assert.equal(parsed.payload.rawResult, 1);
  assert.equal(parsed.remainingStdout, "notice line");
});

test("resolveReadOnlyRuntimeResult preserves raw results when no side effects were blocked", () => {
  const resolved = resolveReadOnlyRuntimeResult({
    rawResultType: "string",
    rawResult: "theme",
    readOnlyState: {
      blockedSqlVerbs: [],
      blockedSqlCount: 0,
      blockedHttpCount: 0,
      blockedMailCount: 0,
      transactionStarted: true,
      transactionRolledBack: true,
      transactionCommitted: false,
    },
  });

  assert.equal(resolved.outcome, "ok");
  assert.equal(resolved.resultType, "string");
  assert.equal(resolved.result, "theme");
});

test("resolveReadOnlyRuntimeResult wraps blocked side effects so success-looking raw results are not authoritative", () => {
  const resolved = resolveReadOnlyRuntimeResult({
    rawResultType: "bool",
    rawResult: true,
    readOnlyState: {
      blockedSqlVerbs: ["INSERT"],
      blockedSqlCount: 1,
      blockedHttpCount: 0,
      blockedMailCount: 0,
      transactionStarted: true,
      transactionRolledBack: true,
      transactionCommitted: false,
    },
  });

  assert.equal(resolved.outcome, "blocked_side_effects");
  assert.equal(resolved.resultType, "localwp_mcp_read_only_blocked");
  assert.deepEqual(resolved.result, {
    status: "blocked",
    reason:
      "Read-only guard prevented one or more side effects, so the raw return value is not authoritative.",
    blockedSideEffects: ["sql_write"],
    writesBlocked: true,
    sideEffectsPrevented: true,
    transactionStarted: true,
    transactionRolledBack: true,
    transactionCommitted: false,
    rawResultType: "bool",
    rawResult: true,
  });
});

test("describeReadOnlyRuntimeOutcome infers blocked side effect categories from counters", () => {
  const described = describeReadOnlyRuntimeOutcome({
    blockedSqlCount: 1,
    blockedHttpCount: 2,
    blockedMailCount: 0,
    transactionStarted: true,
    transactionRolledBack: true,
    transactionCommitted: false,
  });

  assert.equal(described.outcome, "blocked_side_effects");
  assert.deepEqual(described.readOnlyState.blockedSideEffects, [
    "sql_write",
    "http_request",
  ]);
});
