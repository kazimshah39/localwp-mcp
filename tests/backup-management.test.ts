import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  cleanupManagedBackups,
  deleteManagedBackup,
  listManagedBackups,
  normalizeBackupArtifactCategoryInputs,
} from "../src/backup-management.ts";
import type { SiteContext } from "../src/types.ts";

function createFakeSiteContext(siteRoot: string): SiteContext {
  return {
    site: {
      id: "site-id",
      name: "example-site",
      path: siteRoot,
      absolutePath: siteRoot,
      wpRoot: path.join(siteRoot, "app", "public"),
      runtimeDir: path.join(siteRoot, "run"),
      status: "running",
    },
    selectionMethod: "site_name",
    runtimeDir: path.join(siteRoot, "run"),
    wpRoot: path.join(siteRoot, "app", "public"),
    database: "local",
    phpConfigDir: path.join(siteRoot, "php-conf"),
    mysqlDefaultsFile: path.join(siteRoot, "mysql.cnf"),
    mysqlSocket: null,
    mysqlPort: 3306,
    mysqlHost: "127.0.0.1",
    php: {
      packageDir: path.join(siteRoot, "php"),
      platformDirName: "darwin-arm64",
      binaryPath: path.join(siteRoot, "php", "bin", "php"),
      layout: "lightning-services",
    },
    mysql: {
      packageDir: path.join(siteRoot, "mysql"),
      platformDirName: "darwin-arm64",
      binaryPath: path.join(siteRoot, "mysql", "bin", "mysql"),
      layout: "lightning-services",
    },
    magickCoderModulePath: "",
  };
}

async function createBackupDirectory(
  rootPath: string,
  name: string,
  scope: "full" | "database",
  createdAt: string,
) {
  const backupDir = path.join(rootPath, name);
  await mkdir(path.join(backupDir, "app", "sql"), { recursive: true });
  await writeFile(
    path.join(backupDir, "manifest.json"),
    JSON.stringify({
      format: "localwp-mcp-backup-v1",
      createdAt,
      scope,
      copiedDirectories: scope === "full" ? ["app", "conf", "logs"] : [],
      database: {
        file: scope === "full" ? "app/sql/site-backup.sql" : "database.sql",
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(
      backupDir,
      scope === "full" ? "app/sql/site-backup.sql" : "database.sql",
    ),
    "SELECT 1;\n",
    "utf8",
  );
  return backupDir;
}

test("listManagedBackups discovers backup directories and SQL export artifacts", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-backups-"));

  try {
    const context = createFakeSiteContext(tempRoot);
    await createBackupDirectory(
      tempRoot,
      "example-site-full-20260401-120000",
      "full",
      "2026-04-01T12:00:00.000Z",
    );
    await createBackupDirectory(
      tempRoot,
      "example-site-database-20260401-110000",
      "database",
      "2026-04-01T11:00:00.000Z",
    );
    await createBackupDirectory(
      tempRoot,
      "example-site-full-20260401-100000-pre-restore",
      "full",
      "2026-04-01T10:00:00.000Z",
    );
    await mkdir(path.join(tempRoot, "database-exports"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "database-exports", "example-site-export.sql"),
      "SELECT 1;\n",
      "utf8",
    );
    await mkdir(path.join(tempRoot, "pre-import"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "pre-import", "example-site-before-import.sql"),
      "SELECT 1;\n",
      "utf8",
    );

    const result = await listManagedBackups(context, { rootPath: tempRoot });
    const summarizedArtifacts = result.artifacts
      .map((artifact) => ({
        path: artifact.path,
        category: artifact.category,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));

    assert.deepEqual(
      summarizedArtifacts,
      [
        {
          path: "database-exports/example-site-export.sql",
          category: "database_export",
        },
        {
          path: "example-site-database-20260401-110000",
          category: "database_backup",
        },
        {
          path: "example-site-full-20260401-100000-pre-restore",
          category: "pre_restore_backup",
        },
        {
          path: "example-site-full-20260401-120000",
          category: "full_backup",
        },
        {
          path: "pre-import/example-site-before-import.sql",
          category: "pre_import_backup",
        },
      ],
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("deleteManagedBackup removes one recognized artifact", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-backups-"));

  try {
    const context = createFakeSiteContext(tempRoot);
    const backupDir = await createBackupDirectory(
      tempRoot,
      "example-site-full-20260401-120000",
      "full",
      "2026-04-01T12:00:00.000Z",
    );

    const result = await deleteManagedBackup(context, {
      rootPath: tempRoot,
      backupPath: "example-site-full-20260401-120000",
    });

    assert.equal(result.deleted, true);
    await assert.rejects(() => access(backupDir));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("cleanupManagedBackups supports dry-run retention and real deletion", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "localwp-mcp-backups-"));

  try {
    const context = createFakeSiteContext(tempRoot);
    await createBackupDirectory(
      tempRoot,
      "example-site-full-20260401-120000",
      "full",
      "2026-04-01T12:00:00.000Z",
    );
    await createBackupDirectory(
      tempRoot,
      "example-site-full-20260401-110000",
      "full",
      "2026-04-01T11:00:00.000Z",
    );
    await mkdir(path.join(tempRoot, "pre-import"), { recursive: true });
    const preImportPath = path.join(
      tempRoot,
      "pre-import",
      "example-site-before-import.sql",
    );
    await writeFile(preImportPath, "SELECT 1;\n", "utf8");
    await utimes(preImportPath, new Date("2026-04-01T09:00:00.000Z"), new Date("2026-04-01T09:00:00.000Z"));

    const dryRun = await cleanupManagedBackups(context, {
      rootPath: tempRoot,
      categories: ["full_backup"],
      keepLatest: 1,
      dryRun: true,
    });

    assert.equal(dryRun.candidateArtifacts.length, 1);
    assert.equal(dryRun.deletedCount, 0);

    const cleanup = await cleanupManagedBackups(context, {
      rootPath: tempRoot,
      categories: ["pre_import_backup"],
      olderThanDays: 0,
      dryRun: false,
    });

    assert.equal(cleanup.deletedCount, 1);
    const inventory = await listManagedBackups(context, { rootPath: tempRoot });
    assert.equal(
      inventory.artifacts.some(
        (artifact) => artifact.path === "pre-import/example-site-before-import.sql",
      ),
      false,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("normalizeBackupArtifactCategoryInputs accepts friendly aliases", () => {
  assert.deepEqual(
    normalizeBackupArtifactCategoryInputs(["full", "export", "standalone_sql"]),
    ["full_backup", "database_export", "sql_file"],
  );
});
