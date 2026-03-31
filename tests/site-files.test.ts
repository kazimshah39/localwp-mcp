import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  clampSiteFileListEntries,
  clampSiteFileReadBytes,
  clampSiteFileSearchMatches,
  resolveSiteScopedPath,
} from "../src/site-files.ts";

test("clampSiteFileReadBytes respects defaults and upper bounds", () => {
  assert.equal(clampSiteFileReadBytes(undefined), 256 * 1024);
  assert.equal(clampSiteFileReadBytes(128), 128);
  assert.equal(clampSiteFileReadBytes(5 * 1024 * 1024), 1024 * 1024);
});

test("clampSiteFileListEntries respects defaults and upper bounds", () => {
  assert.equal(clampSiteFileListEntries(undefined), 200);
  assert.equal(clampSiteFileListEntries(25), 25);
  assert.equal(clampSiteFileListEntries(5000), 1000);
});

test("clampSiteFileSearchMatches respects defaults and upper bounds", () => {
  assert.equal(clampSiteFileSearchMatches(undefined), 100);
  assert.equal(clampSiteFileSearchMatches(25), 25);
  assert.equal(clampSiteFileSearchMatches(5000), 500);
});

test("resolveSiteScopedPath keeps paths inside the site root", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-site-files-"));

  try {
    await mkdir(path.join(tempRoot, "app", "public"), { recursive: true });
    await writeFile(path.join(tempRoot, "app", "public", "index.php"), "<?php");

    const resolved = await resolveSiteScopedPath(
      tempRoot,
      "app/public/index.php",
    );

    assert.equal(resolved.relativePath, "app/public/index.php");
    assert.equal(resolved.exists, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("resolveSiteScopedPath rejects traversal outside the site root", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-site-files-"));

  try {
    await assert.rejects(() =>
      resolveSiteScopedPath(tempRoot, "../outside.txt"),
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("resolveSiteScopedPath allows missing targets when explicitly requested", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-site-files-"));

  try {
    await mkdir(path.join(tempRoot, "app"), { recursive: true });

    const resolved = await resolveSiteScopedPath(
      tempRoot,
      "app/new-dir/new-file.txt",
      { allowMissingTarget: true },
    );

    assert.equal(resolved.relativePath, "app/new-dir/new-file.txt");
    assert.equal(resolved.exists, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("resolveSiteScopedPath blocks operating on the site root by default", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-site-files-"));

  try {
    await assert.rejects(() => resolveSiteScopedPath(tempRoot, "."));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
