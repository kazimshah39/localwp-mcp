import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { clampLogLines, readLastLines } from "../src/logs.ts";

test("clampLogLines keeps values inside the supported range", () => {
  assert.equal(clampLogLines(undefined), 120);
  assert.equal(clampLogLines(1), 1);
  assert.equal(clampLogLines(9999), 500);
});

test("readLastLines returns only the requested tail of a file", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-logs-"));
  const logPath = path.join(tempDir, "debug.log");

  await writeFile(logPath, "line1\nline2\nline3\nline4\n");

  const result = await readLastLines(logPath, 2);

  assert.equal(result.excerpt, "line3\nline4");
  assert.equal(result.excerptLineCount, 2);
  assert.equal(result.truncated, true);
});
