import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveServerVersion } from "../src/server.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

test("resolveServerVersion prefers npm_package_version when available", () => {
  const previousVersion = process.env.npm_package_version;

  process.env.npm_package_version = "9.9.9";

  try {
    assert.equal(resolveServerVersion(), "9.9.9");
  } finally {
    if (previousVersion === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = previousVersion;
    }
  }
});

test("resolveServerVersion falls back to package.json version", () => {
  const previousVersion = process.env.npm_package_version;

  delete process.env.npm_package_version;

  try {
    assert.equal(resolveServerVersion(), packageJson.version);
  } finally {
    if (previousVersion === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = previousVersion;
    }
  }
});
