import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildBackupDirectoryName,
  resolveBackupSource,
  resolveImportSourcePath,
  sanitizeBackupSegment,
} from "../src/backup.ts";

test("sanitizeBackupSegment normalizes labels for paths", () => {
  assert.equal(sanitizeBackupSegment("Plover CRM / Demo"), "plover-crm-demo");
});

test("buildBackupDirectoryName includes scope and optional label", () => {
  const createdAt = new Date("2026-03-31T10:20:30.000Z");

  assert.equal(
    buildBackupDirectoryName("Plover CRM", "full", "Nightly", createdAt),
    "plover-crm-full-20260331-102030-nightly",
  );
});

test("resolveImportSourcePath reads SQL path from a backup manifest", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-backup-"));
  const sqlPath = path.join(tempDir, "app", "sql", "backup.sql");

  await mkdir(path.dirname(sqlPath), { recursive: true });
  await writeFile(sqlPath, "-- sql");
  await writeFile(
    path.join(tempDir, "manifest.json"),
    JSON.stringify({
      database: {
        file: path.join("app", "sql", "backup.sql"),
      },
    }),
  );

  assert.equal(await resolveImportSourcePath(tempDir), sqlPath);
});

test("resolveBackupSource returns manifest details for full backups", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-restore-"));
  const sqlPath = path.join(tempDir, "app", "sql", "backup.sql");

  await mkdir(path.dirname(sqlPath), { recursive: true });
  await writeFile(sqlPath, "-- sql");
  await mkdir(path.join(tempDir, "app"), { recursive: true });
  await writeFile(
    path.join(tempDir, "manifest.json"),
    JSON.stringify({
      format: "localwp-mcp-backup-v1",
      scope: "full",
      database: {
        file: path.join("app", "sql", "backup.sql"),
      },
      copiedDirectories: ["app", "logs", "ignored"],
    }),
  );

  const resolved = await resolveBackupSource(tempDir);

  assert.equal(resolved.sqlFilePath, sqlPath);
  assert.deepEqual(resolved.copiedDirectories, ["app", "logs"]);
  assert.equal(resolved.manifest?.scope, "full");
});
